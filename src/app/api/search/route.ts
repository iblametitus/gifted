import { findGifts } from "@/lib/agent";

// POST /api/search  { "prompt": "Gift for my brother, 30, loves coffee and travel, around $80", "exclude": ["<product id>"] }
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return Response.json({ error: "prompt is required" }, { status: 400 });
  const exclude = Array.isArray(body?.exclude) ? body.exclude.filter((id: unknown) => typeof id === "string") : [];

  try {
    return Response.json(await findGifts(prompt, exclude));
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Search failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
