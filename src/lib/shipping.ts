// We are the merchant of record, so shipping comes from our own rules
// (Channel3 has no shipping or delivery data). Demo rules, US only.
// One order ships once: free from $75, otherwise the rate of the heaviest item.

import type { Product } from "./channel3";

const HANDLING_DAYS = 1;
const TRANSIT_DAYS = 4;
const FREE_SHIPPING_FROM = 75;

type Priced = Pick<Product, "price" | "weightLb">;

export type Quote = {
  itemPrice: number;
  shipping: number;
  total: number;
  deliveryBy: string; // ISO date
};

export type CartQuote = {
  subtotal: number;
  shipping: number;
  total: number;
  deliveryBy: string;
};

export function cartQuote(products: Priced[], from = new Date()): CartQuote {
  const subtotal = round(products.reduce((sum, p) => sum + p.price, 0));
  const shipping =
    products.length === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : Math.max(...products.map(rateByWeight));
  return {
    subtotal,
    shipping,
    total: round(subtotal + shipping),
    deliveryBy: deliveryDate(from),
  };
}

// Latest delivery date for an order placed on `from` (ISO date)
export function deliveryDate(from = new Date()) {
  return addBusinessDays(from, HANDLING_DAYS + TRANSIT_DAYS).toISOString().slice(0, 10);
}

// Saved gifts keep their prices (checked again at checkout), but the delivery date
// has to count from today, otherwise yesterday's ideas promise a day too early.
export function withFreshDelivery<T extends { quote: Quote }>(items: T[], from = new Date()): T[] {
  const deliveryBy = deliveryDate(from);
  return items.map((item) => ({ ...item, quote: { ...item.quote, deliveryBy } }));
}

// A single gift bought on its own
export function quote(product: Priced, from = new Date()): Quote {
  const { subtotal, ...rest } = cartQuote([product], from);
  return { itemPrice: subtotal, ...rest };
}

function rateByWeight({ weightLb }: Priced) {
  if (weightLb == null || weightLb <= 1) return 5.99;
  if (weightLb <= 5) return 9.99;
  return 14.99;
}

function addBusinessDays(date: Date, days: number) {
  const d = new Date(date);
  while (days > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days--;
  }
  return d;
}

const round = (n: number) => Math.round(n * 100) / 100;
