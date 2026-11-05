import { addContribution } from "@/lib/groups";
import { authorizeOrder } from "@/lib/paypal";

// GET /api/groups/:id/return?token=<orderId>&name=<contributor>
// PayPal sends the contributor here after approval. We authorize (reserve) the share,
// count it, and send them back to the group page. A redirect keeps reloads harmless.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const back = (status: string) => Response.redirect(new URL(`/group/${id}?${status}`, url.origin), 303);

  const token = url.searchParams.get("token");
  const name = (url.searchParams.get("name") ?? "").trim().slice(0, 40) || "A friend";
  if (!token) return back("error=missing-order");

  try {
    const auth = await authorizeOrder(token);
    if (auth.groupId !== id) return back("error=wrong-group");

    const { accepted } = await addContribution(
      id,
      { name, amount: auth.amount, authorizationId: auth.authorizationId, orderId: token },
      auth.shipping,
    );
    return back(accepted ? "joined=1" : "refused=1");
  } catch (error) {
    console.error(error);
    return back("error=payment");
  }
}
