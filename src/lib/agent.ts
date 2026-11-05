// The gift agent: understand the request, search Channel3, pick the best 3.
// Progress is reported step by step through `emit`, so the UI can show what the agent is doing.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { resolveBudget } from "./budget";
import { searchProducts, type Product } from "./channel3";
import { quote } from "./shipping";
import type { GiftFields, SearchEvent, SearchRequest, Suggestion } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const client = new Anthropic();

// Step 1: request -> structured search plan
const GiftBrief = z.object({
  recipient: z.string().describe("Who the gift is for, e.g. 'brother, 30'. Empty if unknown"),
  occasion: z.string().nullable(),
  interests: z.array(z.string()),
  // The model only reads the budget; the allowed range is computed in budget.ts
  budget_usd: z.number().nullable().describe("The budget amount the user named, or the upper end of a range"),
  budget_is_approximate: z
    .boolean()
    .describe("True only if the user softened it: 'around', 'about', 'roughly', '~', 'ish'"),
  min_price_usd: z.number().nullable().describe("Only if the user explicitly named a lower bound"),
  deliver_by: z.string().nullable().describe("ISO date if the user named a deadline"),
  follow_up_question: z
    .string()
    .nullable()
    .describe("One short, friendly question if too little is known about the person, else null"),
  search_queries: z
    .array(z.string())
    .describe("2-3 short, distinct product search queries, like a shopper would type them"),
});
type GiftBrief = z.infer<typeof GiftBrief>;

// Step 3: candidates -> top 3. Candidates are numbered: short numbers get mixed up
// far less often than random product ids, and the title echo lets us catch mix-ups.
const Picks = z.object({
  picks: z.array(
    z.object({
      candidate: z.number().describe("The candidate number"),
      title: z.string().describe("The candidate's title, copied exactly"),
      reason: z.string().describe("One or two sentences: why this product fits this person"),
    }),
  ),
});

async function understandRequest(request: string, mayAsk: boolean): Promise<GiftBrief> {
  const today = new Date().toISOString().slice(0, 10);
  const asking = mayAsk
    ? "If the request says nothing about what the person likes (no interests, hobbies, personality or wishes), " +
      "set follow_up_question to one short, friendly question about exactly that. Otherwise null. "
    : "Do not ask questions: set follow_up_question to null and make the best of what you know. ";
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(GiftBrief) },
    system:
      `You turn a gift request into a search plan for a US product catalog. Today is ${today}. ` +
      "Prices are in USD. If no budget is given, leave the budget fields null. " +
      "Form fields override anything the free text says. " +
      asking +
      "Search queries name concrete product types, not the occasion.",
    messages: [{ role: "user", content: request }],
  });
  return parsedOrThrow(res);
}

export async function findGifts(req: SearchRequest, emit: (event: SearchEvent) => void) {
  const { fields } = req;
  const request = describeRequest(req.prompt, fields);

  emit({ type: "step", step: "understanding" });
  const brief = await understandRequest(request, !req.followUpAsked);
  if (!req.followUpAsked && brief.follow_up_question) {
    emit({ type: "question", question: brief.follow_up_question });
    return;
  }

  const budget = resolveBudget(fields, {
    budgetUsd: brief.budget_usd,
    approximate: brief.budget_is_approximate,
    minUsd: brief.min_price_usd,
  });
  const deliverBy = fields.deliverBy || brief.deliver_by;
  const queries = brief.search_queries.slice(0, 3);

  emit({ type: "step", step: "searching", detail: queries.join(" · ") });
  const results = await Promise.all(
    queries.map((query) => searchProducts({ query, minPrice: budget.min, maxPrice: budget.max })),
  );
  // The budget is what the buyer pays, so shipping counts too
  const seen = new Set(req.exclude ?? []);
  const candidates = dedupe(results.flat()).filter(
    (p) => !seen.has(p.id) && (budget.max == null || quote(p).total <= budget.max),
  );

  let suggestions: Suggestion[] = [];
  if (candidates.length > 0) {
    emit({ type: "step", step: "picking", detail: `${candidates.length} products in your budget` });
    suggestions = await pickGifts(request, brief, candidates);
  }

  // Delivery time is the same for every product (our own shipping rules)
  const earliest = quote({ price: 0, weightLb: null } as Product).deliveryBy;
  const deliveryWarning =
    deliverBy && earliest > deliverBy
      ? `Our earliest delivery is ${formatDate(earliest)}, after your date (${formatDate(deliverBy)}).`
      : null;

  emit({
    type: "result",
    result: {
      understood: { recipient: brief.recipient, occasion: brief.occasion, interests: brief.interests },
      budget,
      deliverBy,
      deliveryWarning,
      suggestions,
    },
  });
}

async function pickGifts(request: string, brief: GiftBrief, candidates: Product[]): Promise<Suggestion[]> {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: zodOutputFormat(Picks) },
    system:
      "You are a thoughtful gift advisor. From the candidate products, pick the 3 best gifts for this person. " +
      "Prefer variety (not three versions of the same thing), real usefulness and a personal fit. " +
      "Each reason must describe that exact candidate, not another one. " +
      "Write reasons in English, warm and concrete, no hype. Do not mention prices: the page shows the final price.",
    messages: [
      {
        role: "user",
        content:
          `Gift request:\n${request}\n\nBrief: ${JSON.stringify(brief)}\n\n` +
          `Candidates:\n${JSON.stringify(candidates.map(forPrompt))}`,
      },
    ],
  });

  return parsedOrThrow(res)
    .picks.filter((pick) => candidates[pick.candidate - 1]?.title === pick.title)
    .slice(0, 3)
    .map((pick) => {
      const product = candidates[pick.candidate - 1];
      return { ...product, reason: pick.reason, quote: quote(product) };
    });
}

// Short invite for a group gift, ready to paste into a group chat
const Invite = z.object({ message: z.string() });

export async function writeInvite(opts: {
  title: string;
  recipient: string | null;
  organizer: string;
  share: number;
  people: number;
}) {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 1000,
    output_config: { effort: "low", format: zodOutputFormat(Invite) },
    system:
      "Write a short, warm invite (2-3 sentences, English) for a group chat, asking friends to chip in on a group gift. " +
      "Mention the gift, who it's for, the share per person and that nobody is charged unless everyone joins. " +
      "No hashtags, at most one emoji, don't include a link (it is added below).",
    messages: [{ role: "user", content: JSON.stringify(opts) }],
  });
  return parsedOrThrow(res).message;
}

// Free text and form fields as one message for the model
function describeRequest(prompt: string, fields: GiftFields) {
  const lines = [
    fields.recipient && `- For: ${fields.recipient}`,
    fields.interests && `- Interests: ${fields.interests}`,
    fields.occasion && `- Occasion: ${fields.occasion}`,
    fields.budgetUsd && `- Budget: ${fields.budgetApprox ? "around " : "max "}$${fields.budgetUsd}`,
    fields.deliverBy && `- Deliver by: ${fields.deliverBy}`,
  ].filter(Boolean);
  const parts = [];
  if (prompt.trim()) parts.push(`Free text:\n${prompt.trim()}`);
  if (lines.length) parts.push(`Form fields (these override the free text):\n${lines.join("\n")}`);
  return parts.join("\n\n");
}

function parsedOrThrow<T>(res: { stop_reason: string | null; parsed_output?: T | null }): T {
  if (res.stop_reason === "refusal") throw new Error("Claude declined this request");
  if (!res.parsed_output) throw new Error(`No structured output (stop_reason: ${res.stop_reason})`);
  return res.parsed_output;
}

function dedupe(products: Product[]) {
  return [...new Map(products.map((p) => [p.id, p])).values()];
}

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// Compact view for the model: enough to judge fit, without image/buy URLs
function forPrompt(p: Product, i: number) {
  return {
    candidate: i + 1,
    title: p.title,
    brand: p.brand,
    category: p.category,
    price_usd: p.price,
    merchant: p.merchant,
    description: p.description,
    key_features: p.keyFeatures,
  };
}
