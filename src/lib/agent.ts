// The gift agent: understand the request, search Channel3, pick the best 3.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { budgetRange } from "./budget";
import { searchProducts, type Product } from "./channel3";
import { quote, type Quote } from "./shipping";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const client = new Anthropic();

// Step 1: free text -> structured search plan
const GiftBrief = z.object({
  recipient: z.string().describe("Who the gift is for, e.g. 'brother, 30'"),
  occasion: z.string().nullable(),
  interests: z.array(z.string()),
  // The model only reads the budget; the allowed range is computed in budget.ts
  budget_usd: z.number().nullable().describe("The budget amount the user named, or the upper end of a range"),
  budget_is_approximate: z
    .boolean()
    .describe("True only if the user softened it: 'around', 'about', 'roughly', '~', 'ish'"),
  min_price_usd: z.number().nullable().describe("Only if the user explicitly named a lower bound"),
  deliver_by: z.string().nullable().describe("ISO date if the user named a deadline"),
  search_queries: z
    .array(z.string())
    .describe("2-3 short, distinct product search queries, like a shopper would type them"),
});
export type GiftBrief = z.infer<typeof GiftBrief>;

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

export type Suggestion = Product & { reason: string; quote: Quote };

export async function understandRequest(prompt: string): Promise<GiftBrief> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(GiftBrief) },
    system:
      `You turn a gift request into a search plan for a US product catalog. Today is ${today}. ` +
      "Prices are in USD. If no budget is given, leave the budget fields null. " +
      "Search queries name concrete product types, not the occasion.",
    messages: [{ role: "user", content: prompt }],
  });
  return parsedOrThrow(res);
}

// exclude: product ids already shown, for "Show other ideas"
export async function findGifts(prompt: string, exclude: string[] = []) {
  const brief = await understandRequest(prompt);
  const { min, max } = budgetRange({
    budgetUsd: brief.budget_usd,
    approximate: brief.budget_is_approximate,
    minUsd: brief.min_price_usd,
  });

  const results = await Promise.all(
    brief.search_queries.slice(0, 3).map((query) => searchProducts({ query, minPrice: min, maxPrice: max })),
  );
  // The budget is what the buyer pays, so shipping counts too
  const seen = new Set(exclude);
  const candidates = dedupe(results.flat()).filter(
    (p) => !seen.has(p.id) && (max == null || quote(p).total <= max),
  );
  if (candidates.length === 0) return { brief, suggestions: [] as Suggestion[] };

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
          `Gift request: ${prompt}\n\nBrief: ${JSON.stringify(brief)}\n\n` +
          `Candidates:\n${JSON.stringify(candidates.map(forPrompt))}`,
      },
    ],
  });

  const suggestions = parsedOrThrow(res)
    .picks.filter((pick) => candidates[pick.candidate - 1]?.title === pick.title)
    .slice(0, 3)
    .map((pick) => {
      const product = candidates[pick.candidate - 1];
      return { ...product, reason: pick.reason, quote: quote(product) };
    });

  return { brief, suggestions, model: res.model };
}

function parsedOrThrow<T>(res: { stop_reason: string | null; parsed_output?: T | null }): T {
  if (res.stop_reason === "refusal") throw new Error("Claude declined this request");
  if (!res.parsed_output) throw new Error(`No structured output (stop_reason: ${res.stop_reason})`);
  return res.parsed_output;
}

function dedupe(products: Product[]) {
  return [...new Map(products.map((p) => [p.id, p])).values()];
}

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
