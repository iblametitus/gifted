import { getGroup, nextShare } from "@/lib/groups";
import { publicOrigin, rateLimit } from "@/lib/guard";
import { createShareOrder } from "@/lib/paypal";

// POST /api/groups/:id/contribute  { name }  ->  { approveUrl }
// Reserves the next open share with PayPal (AUTHORIZE, nothing is charged yet)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return Response.json({ error: "Please enter your name" }, { status: 400 });
  const limited = await rateLimit(request, "checkout");
  if (limited) return limited;

  try {
    const group = await getGroup(id);
    if (!group) return Response.json({ error: "Group gift not found" }, { status: 404 });
    const share = nextShare(group);
    if (share === null) return Response.json({ error: "This group gift is closed" }, { status: 409 });

    const order = await createShareOrder({
      groupId: group.id,
      contributor: name,
      amount: share,
      description: `Your share: ${group.product.title}${group.recipient ? ` for ${group.recipient}` : ""}`,
      withShipping: group.contributions.length === 0,
      origin: publicOrigin(request),
    });
    return Response.json({ approveUrl: order.approveUrl });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not start PayPal" }, { status: 502 });
  }
}
