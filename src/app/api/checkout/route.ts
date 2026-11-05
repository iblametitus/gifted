import { getProduct } from "@/lib/channel3";
import { createOrder } from "@/lib/paypal";
import { quote } from "@/lib/shipping";

// POST /api/checkout  { "productId": "eM2V9RS" }  ->  { orderId, approveUrl, quote }
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const productId = typeof body?.productId === "string" ? body.productId : "";
  if (!productId) return Response.json({ error: "productId is required" }, { status: 400 });

  try {
    // Re-check price and stock right before payment
    const product = await getProduct(productId);
    if (!product) return Response.json({ error: "This product is no longer available" }, { status: 409 });

    const q = quote(product);
    const order = await createOrder(product, q, new URL(request.url).origin);
    return Response.json({ ...order, quote: q });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Checkout failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
