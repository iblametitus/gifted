// We are the merchant of record, so shipping comes from our own rules
// (Channel3 has no shipping or delivery data). Demo rules, US only.

import type { Product } from "./channel3";

const HANDLING_DAYS = 1;
const TRANSIT_DAYS = 4;

export type Quote = {
  itemPrice: number;
  shipping: number;
  total: number;
  deliveryBy: string; // ISO date
};

export function quote(product: Product, from = new Date()): Quote {
  const shipping = shippingCost(product);
  return {
    itemPrice: product.price,
    shipping,
    total: round(product.price + shipping),
    deliveryBy: addBusinessDays(from, HANDLING_DAYS + TRANSIT_DAYS).toISOString().slice(0, 10),
  };
}

function shippingCost({ price, weightLb }: Product) {
  if (price >= 75) return 0;
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
