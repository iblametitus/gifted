import { getProduct } from "@/lib/channel3";
import { createOrder } from "@/lib/paypal";
import { cartQuote } from "@/lib/shipping";

const MAX_ITEMS = 10;

// POST /api/checkout  { "productIds": ["eM2V9RS", ...] }  ->  { orderId, approveUrl, quote }
// One id = "Buy now", several = the cart. Everything is paid in one PayPal order.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.productIds)
    ? [...new Set<string>(body.productIds.filter((id: unknown) => typeof id === "string"))]
    : [];
  if (ids.length === 0) return Response.json({ error: "productIds is required" }, { status: 400 });
  if (ids.length > MAX_ITEMS) return Response.json({ error: `At most ${MAX_ITEMS} gifts per order` }, { status: 400 });

  try {
    // Re-check price and stock right before payment
    const products = await Promise.all(ids.map(getProduct));
    const missing = products.filter((p) => p === null).length;
    if (missing > 0) {
      const what =
        ids.length === 1 ? "This gift is" : `${missing} of your gifts ${missing === 1 ? "is" : "are"}`;
      return Response.json({ error: `${what} no longer available. Please remove and try again.` }, { status: 409 });
    }
    const available = products.filter((p) => p !== null);

    const q = cartQuote(available);
    const order = await createOrder(available, q, new URL(request.url).origin);
    return Response.json({ ...order, quote: q });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Checkout failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
