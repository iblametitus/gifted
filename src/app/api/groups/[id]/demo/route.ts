import { demoMode, fillWithDemoFriends } from "@/lib/groups";

// POST /api/groups/:id/demo  ->  fills the open spots with simulated friends (DEMO_MODE only)
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!demoMode()) return Response.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  try {
    await fillWithDemoFriends(id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Demo failed" }, { status: 409 });
  }
}
