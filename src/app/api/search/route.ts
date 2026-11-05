import { findGifts } from "@/lib/agent";
import type { GiftFields, SearchEvent, SearchRequest } from "@/lib/types";

// POST /api/search  { prompt, fields, exclude?, followUpAsked? }
// Answers with a stream of JSON lines (SearchEvent), so the UI can show each agent step live.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const req = parseRequest(body);
  if (!req) return Response.json({ error: "Describe the person or fill in at least one field" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: SearchEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await findGifts(req, emit);
      } catch (error) {
        console.error(error);
        emit({ type: "error", message: error instanceof Error ? error.message : "Search failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
}

function parseRequest(body: unknown): SearchRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const f = (typeof b.fields === "object" && b.fields !== null ? b.fields : {}) as Record<string, unknown>;

  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined);
  const fields: GiftFields = {
    recipient: text(f.recipient),
    interests: text(f.interests),
    occasion: text(f.occasion),
    budgetUsd: typeof f.budgetUsd === "number" && f.budgetUsd > 0 ? f.budgetUsd : undefined,
    budgetApprox: f.budgetApprox === true,
    deliverBy: typeof f.deliverBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.deliverBy) ? f.deliverBy : undefined,
  };
  const prompt = typeof b.prompt === "string" ? b.prompt.slice(0, 2000) : "";
  const hasField = Object.entries(fields).some(([k, v]) => k !== "budgetApprox" && v !== undefined);
  if (!prompt.trim() && !hasField) return null;

  return {
    prompt,
    fields,
    exclude: Array.isArray(b.exclude) ? b.exclude.filter((id): id is string => typeof id === "string") : [],
    followUpAsked: b.followUpAsked === true,
  };
}
