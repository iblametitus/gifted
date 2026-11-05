// PayPal Orders v2 (Sandbox): create order -> buyer approves on PayPal -> capture.

import type { Product } from "./channel3";
import type { CartQuote } from "./shipping";

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

async function accessToken() {
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function paypal<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${await accessToken()}`,
      "content-type": "application/json",
      prefer: "return=representation", // full order incl. items in every response
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new PayPalError(res.status, data);
  return data as T;
}

export class PayPalError extends Error {
  constructor(
    public status: number,
    public details: { name?: string; details?: { issue?: string }[] },
  ) {
    super(`PayPal ${status}: ${details.name ?? "error"} ${details.details?.[0]?.issue ?? ""}`.trim());
  }
}

const usd = (n: number) => ({ currency_code: "USD", value: n.toFixed(2) });

type Link = { rel: string; href: string };

// One order for one gift or a whole cart. custom_id carries the product ids,
// so the return page knows what was bought (e.g. to empty the cart).
export async function createOrder(products: Product[], q: CartQuote, origin: string) {
  const description =
    products.length === 1 ? `Gift: ${products[0].title}` : `${products.length} gifts from Gifted`;
  const order = await paypal<{ id: string; links: Link[] }>("/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: "gifts",
        custom_id: products.map((p) => p.id).join(","),
        description: description.slice(0, 127),
        amount: {
          ...usd(q.total),
          breakdown: { item_total: usd(q.subtotal), shipping: usd(q.shipping) },
        },
        items: products.map((p) => ({
          name: p.title.slice(0, 127),
          quantity: "1",
          unit_amount: usd(p.price),
          category: "PHYSICAL_GOODS",
        })),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Gifted",
          user_action: "PAY_NOW",
          shipping_preference: "GET_FROM_FILE",
          return_url: `${origin}/checkout/return`,
          cancel_url: `${origin}/?cancelled=1`,
        },
      },
    },
  });

  const approveUrl = order.links.find((l) => l.rel === "payer-action")?.href;
  if (!approveUrl) throw new Error("PayPal returned no approval link");
  return { orderId: order.id, approveUrl };
}

export type CapturedOrder = {
  id: string;
  status: string;
  payer?: { email_address?: string; name?: { given_name?: string } };
  purchase_units: {
    reference_id: string;
    custom_id?: string;
    description?: string;
    items?: { name: string; unit_amount: { value: string } }[];
    amount?: { breakdown?: { item_total?: { value: string }; shipping?: { value: string } } };
    shipping?: { name?: { full_name?: string }; address?: { address_line_1?: string; admin_area_2?: string; admin_area_1?: string; postal_code?: string } };
    payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[] };
  }[];
};

// The return page can be reloaded: an already captured order is fetched instead of failing
export async function captureOrder(orderId: string) {
  try {
    return await paypal<CapturedOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {});
  } catch (error) {
    const alreadyCaptured =
      error instanceof PayPalError && error.details.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED");
    if (!alreadyCaptured) throw error;
    return paypal<CapturedOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  }
}
