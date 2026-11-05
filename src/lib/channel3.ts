// Channel3 product search: https://channel3.ai/docs
// Raw API objects are reduced to what the agent and the UI need.

const API_BASE = "https://api.trychannel3.com/v1";

type RawOffer = {
  url: string;
  domain: string;
  price: { price: number; currency: string };
  availability: string;
  dimensions: { weight?: { number: number; unit: string } } | null;
};

type RawProduct = {
  id: string;
  title: string;
  description?: string;
  brands?: { name: string }[];
  images?: { url: string; is_main_image?: boolean }[];
  category?: { title: string } | null;
  key_features?: string[];
  offers?: RawOffer[];
};

export type Product = {
  id: string;
  title: string;
  description: string;
  brand: string | null;
  category: string | null;
  keyFeatures: string[];
  imageUrl: string | null;
  // Cheapest in-stock offer within the budget
  price: number;
  currency: string;
  merchant: string;
  buyUrl: string;
  weightLb: number | null;
};

export type SearchParams = {
  query: string;
  minPrice: number | null;
  maxPrice: number | null;
  limit?: number;
};

export async function searchProducts({ query, minPrice, maxPrice, limit = 10 }: SearchParams) {
  const price: Record<string, number> = {};
  if (minPrice != null) price.min_price = minPrice;
  if (maxPrice != null) price.max_price = maxPrice;

  const res = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ query, filters: { price, availability: ["InStock"] }, limit }),
  });
  if (!res.ok) throw new Error(`Channel3 ${res.status}: ${await res.text()}`);

  const data: { products?: RawProduct[] } = await res.json();
  return (data.products ?? [])
    .map((p) => toProduct(p, minPrice, maxPrice))
    .filter((p): p is Product => p !== null);
}

// Fresh lookup before checkout: current price and stock, never trust the browser
export async function getProduct(id: string) {
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(id)}`, { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Channel3 ${res.status}: ${await res.text()}`);
  return toProduct(await res.json(), null, null);
}

function authHeaders() {
  const key = process.env.CHANNEL3_API_KEY;
  if (!key) throw new Error("CHANNEL3_API_KEY missing");
  return { "x-api-key": key };
}

function toProduct(p: RawProduct, minPrice: number | null, maxPrice: number | null): Product | null {
  const offers = (p.offers ?? [])
    .filter((o) => o.availability === "InStock" && o.price.currency === "USD")
    .filter((o) => (minPrice == null || o.price.price >= minPrice) && (maxPrice == null || o.price.price <= maxPrice))
    .sort((a, b) => a.price.price - b.price.price);
  const offer = offers[0];
  if (!offer) return null;

  const image = p.images?.find((i) => i.is_main_image) ?? p.images?.[0];
  const weight = offer.dimensions?.weight;

  return {
    id: p.id,
    title: p.title,
    description: p.description ?? "",
    brand: p.brands?.[0]?.name ?? null,
    category: p.category?.title ?? null,
    keyFeatures: p.key_features ?? [],
    imageUrl: image?.url ?? null,
    price: offer.price.price,
    currency: offer.price.currency,
    merchant: offer.domain,
    buyUrl: offer.url,
    weightLb: weight?.unit === "lb" ? weight.number : null,
  };
}
