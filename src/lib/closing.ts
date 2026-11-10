// The agent's last job: everyone is in, now close the group gift safely.
// 1. Check price and stock again (the reservations may be days old).
// 2. Collect every reserved share with PayPal, one by one.
// 3. If anything goes wrong, nobody pays: refund what was collected, release the rest.
// PayPal and Channel3 are passed in, so this runs in tests without network.

import type { Product } from "./channel3";
import type { Group } from "./groups";
import { splitShares } from "./shares.ts";
import type { Quote } from "./shipping";

export type CancelReason = "expired" | "sold-out" | "price-changed" | "check-failed" | "payment-failed";

export type ClosingDeps = {
  getProduct: (id: string) => Promise<Product | null>;
  quote: (product: Product) => Quote;
  capture: (authorizationId: string, amount: number) => Promise<{ id: string; status: string }>;
  refund: (captureId: string) => Promise<unknown>;
  release: (authorizationId: string) => Promise<unknown>;
  now?: () => Date;
};

const CAPTURED = new Set(["COMPLETED", "PENDING"]);

export async function closeGroup(group: Group, deps: ClosingDeps): Promise<Group> {
  const now = deps.now ?? (() => new Date());
  const priceThen = group.quote.total;

  // 1. Fresh price and stock. One retry, a hiccup at Channel3 shouldn't sink the group.
  let product: Product | null;
  try {
    product = await deps.getProduct(group.product.id).catch(() => deps.getProduct(group.product.id));
  } catch (error) {
    console.error("closing: product check failed", error);
    group.closing = { checkedAt: now().toISOString(), priceThen, priceNow: null };
    return releaseAll(group, deps, "check-failed");
  }
  const priceNow = product ? deps.quote(product).total : null;
  group.closing = { checkedAt: now().toISOString(), priceThen, priceNow };
  if (product == null) return releaseAll(group, deps, "sold-out");
  if (priceNow! > priceThen + 0.005) return releaseAll(group, deps, "price-changed");

  // Cheaper now: everyone pays their share of the new price. PayPal can capture less than
  // was reserved, the rest of each reservation is released automatically.
  const cheaper = priceNow! < priceThen - 0.005;
  const charges = cheaper ? splitShares(priceNow!, group.shares.length) : group.shares;
  if (cheaper) {
    group.quote = deps.quote(product);
    group.product.merchant = product.merchant;
  }

  // 2. Collect each share. Simulated demo friends never reach PayPal.
  for (const [i, c] of group.contributions.entries()) {
    if (c.captureId) continue;
    const charge = Math.min(charges[i] ?? c.amount, c.amount);
    if (c.demo) {
      c.charged = charge;
      continue;
    }
    try {
      const capture = await deps.capture(c.authorizationId, charge);
      if (!CAPTURED.has(capture.status)) throw new Error(`capture status ${capture.status}`);
      c.captureId = capture.id;
      c.charged = charge;
    } catch (error) {
      console.error(`closing: capture failed for ${c.authorizationId}`, error);
      // 3. Undo: refund everyone already charged, release everyone not yet charged
      for (const done of group.contributions) {
        if (!done.captureId || done.refunded) continue;
        try {
          await deps.refund(done.captureId);
          done.refunded = true;
        } catch (refundError) {
          console.error(`closing: REFUND FAILED for capture ${done.captureId}, refund by hand`, refundError);
        }
      }
      return releaseAll(group, deps, "payment-failed");
    }
  }

  group.status = "complete";
  group.completedAt = now().toISOString();
  return group;
}

// Releases every reservation that wasn't collected and closes the group. Never throws on PayPal errors:
// an authorization that can't be voided expires on its own after a few days.
export async function releaseAll(group: Group, deps: Pick<ClosingDeps, "release">, reason: CancelReason) {
  for (const c of group.contributions) {
    if (c.demo || c.captureId) continue;
    await Promise.resolve()
      .then(() => deps.release(c.authorizationId))
      .catch((error) => console.error(`closing: release failed for ${c.authorizationId}`, error));
  }
  group.status = "cancelled";
  group.cancelReason = reason;
  return group;
}

// "…4F7K": enough to match a PayPal receipt, without publishing the full id
export const shortReceipt = (captureId: string) => `…${captureId.slice(-4).toUpperCase()}`;
