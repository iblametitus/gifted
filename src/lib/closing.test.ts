// Run: npm test
// Closing a group gift with fake PayPal and Channel3: who gets charged, refunded or released.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Product } from "./channel3.ts";
import { closeGroup, releaseAll, shortReceipt, type ClosingDeps } from "./closing.ts";
import type { Group } from "./groups.ts";
import { quote } from "./shipping.ts";

const product = (price: number) => ({ id: "p1", price, weightLb: null }) as Product;

function group(price = 80, people = 3, demoFrom = people): Group {
  const q = quote(product(price));
  return {
    id: "abcdefghjk",
    createdAt: "2026-11-10T10:00:00Z",
    expiresAt: "2026-11-13T10:00:00Z",
    product: { id: "p1", title: "Gift", brand: null, merchant: "shop.com", imageUrl: null, reason: "" },
    quote: q,
    organizer: "Anna",
    recipient: "Lena",
    invite: "",
    shares: Array(people).fill(q.total / people),
    contributions: Array.from({ length: people }, (_, i) => ({
      name: `P${i}`,
      amount: q.total / people,
      authorizationId: `auth-${i}`,
      orderId: `order-${i}`,
      at: "2026-11-10T11:00:00Z",
      demo: i >= demoFrom ? true : undefined,
    })),
    shipTo: null,
    status: "collecting",
  };
}

// Records every PayPal call. failCapture: authorization id whose capture fails.
function fakes(opts: { priceNow?: number | null; failCapture?: string; productError?: number } = {}) {
  const calls = {
    captured: [] as string[],
    amounts: [] as number[],
    refunded: [] as string[],
    released: [] as string[],
    lookups: 0,
  };
  const deps: ClosingDeps = {
    getProduct: async () => {
      calls.lookups++;
      if (opts.productError && calls.lookups <= opts.productError) throw new Error("Channel3 503");
      return opts.priceNow === null ? null : product(opts.priceNow ?? 80);
    },
    quote: (p) => quote(p),
    capture: async (authId, amount) => {
      if (authId === opts.failCapture) throw new Error("PayPal 422: INSTRUMENT_DECLINED");
      calls.captured.push(authId);
      calls.amounts.push(amount);
      return { id: `CAP${authId.toUpperCase()}`, status: "COMPLETED" };
    },
    refund: async (captureId) => void calls.refunded.push(captureId),
    release: async (authId) => void calls.released.push(authId),
    now: () => new Date("2026-11-11T12:00:00Z"),
  };
  return { deps, calls };
}

test("everyone in and the price holds: every share is collected", async () => {
  const { deps, calls } = fakes();
  const g = await closeGroup(group(), deps);
  assert.equal(g.status, "complete");
  assert.deepEqual(calls.captured, ["auth-0", "auth-1", "auth-2"]);
  assert.deepEqual(g.contributions.map((c) => c.captureId), ["CAPAUTH-0", "CAPAUTH-1", "CAPAUTH-2"]);
  assert.deepEqual(g.closing, { checkedAt: "2026-11-11T12:00:00.000Z", priceThen: 80, priceNow: 80 });
  assert.equal(calls.released.length + calls.refunded.length, 0);
});

test("same price: each share is collected as reserved", async () => {
  const { deps, calls } = fakes({ priceNow: 100 });
  const g = group(100, 3);
  g.shares = [33.34, 33.33, 33.33];
  g.contributions.forEach((c, i) => (c.amount = g.shares[i]));
  await closeGroup(g, deps);
  assert.deepEqual(calls.amounts, [33.34, 33.33, 33.33]);
});

test("cheaper now: everyone pays their share of the new price, never more than reserved", async () => {
  const { deps, calls } = fakes({ priceNow: 78 });
  const g = group(80, 3);
  g.shares = [26.67, 26.67, 26.66];
  g.contributions.forEach((c, i) => (c.amount = g.shares[i]));
  await closeGroup(g, deps);
  assert.equal(g.status, "complete");
  assert.deepEqual(calls.amounts, [26, 26, 26]);
  assert.deepEqual(g.contributions.map((c) => c.charged), [26, 26, 26]);
  assert.equal(g.quote.total, 78); // the group now shows the price that was paid
  assert.equal(g.closing?.priceThen, 80);
});

test("cheaper now with demo friends: they get the new share too, without PayPal", async () => {
  const { deps, calls } = fakes({ priceNow: 76 }); // free shipping from $75, so the total is 76
  const g = await closeGroup(group(80, 4, 1), deps);
  assert.deepEqual(calls.amounts, [19]);
  assert.deepEqual(g.contributions.map((c) => c.charged), [19, 19, 19, 19]);
});

test("price went up: nobody is charged, every reservation is released", async () => {
  const { deps, calls } = fakes({ priceNow: 95 });
  const g = await closeGroup(group(), deps);
  assert.equal(g.status, "cancelled");
  assert.equal(g.cancelReason, "price-changed");
  assert.equal(g.closing?.priceNow, 95);
  assert.deepEqual(calls.captured, []);
  assert.deepEqual(calls.released, ["auth-0", "auth-1", "auth-2"]);
});

test("sold out: nobody is charged", async () => {
  const { deps, calls } = fakes({ priceNow: null });
  const g = await closeGroup(group(), deps);
  assert.equal(g.cancelReason, "sold-out");
  assert.deepEqual(calls.captured, []);
  assert.equal(calls.released.length, 3);
});

test("one failed product lookup is retried", async () => {
  const { deps, calls } = fakes({ productError: 1 });
  assert.equal((await closeGroup(group(), deps)).status, "complete");
  assert.equal(calls.lookups, 2);
});

test("the product check keeps failing: nobody is charged", async () => {
  const { deps, calls } = fakes({ productError: 2 });
  const g = await closeGroup(group(), deps);
  assert.equal(g.cancelReason, "check-failed");
  assert.deepEqual(calls.captured, []);
});

test("second capture fails: the first share is refunded, the rest released", async () => {
  const { deps, calls } = fakes({ failCapture: "auth-1" });
  const g = await closeGroup(group(), deps);
  assert.equal(g.status, "cancelled");
  assert.equal(g.cancelReason, "payment-failed");
  assert.deepEqual(calls.captured, ["auth-0"]);
  assert.deepEqual(calls.refunded, ["CAPAUTH-0"]);
  assert.deepEqual(calls.released, ["auth-1", "auth-2"]);
  assert.equal(g.contributions[0].refunded, true);
});

test("a capture that comes back DECLINED counts as failed", async () => {
  const { deps, calls } = fakes();
  deps.capture = async (authId) => ({ id: `CAP-${authId}`, status: authId === "auth-0" ? "DECLINED" : "COMPLETED" });
  const g = await closeGroup(group(), deps);
  assert.equal(g.cancelReason, "payment-failed");
  assert.deepEqual(calls.released, ["auth-0", "auth-1", "auth-2"]);
});

test("simulated demo friends never reach PayPal", async () => {
  const { deps, calls } = fakes();
  const g = await closeGroup(group(80, 4, 1), deps);
  assert.equal(g.status, "complete");
  assert.deepEqual(calls.captured, ["auth-0"]);

  const cancelled = fakes({ priceNow: 99 });
  await closeGroup(group(80, 4, 1), cancelled.deps);
  assert.deepEqual(cancelled.calls.released, ["auth-0"]);
});

test("a release error doesn't stop the others from being released", async () => {
  const { deps, calls } = fakes();
  deps.release = async (authId) => {
    if (authId === "auth-0") throw new Error("PayPal 500");
    calls.released.push(authId);
  };
  const g = await releaseAll(group(), deps, "expired");
  assert.equal(g.status, "cancelled");
  assert.deepEqual(calls.released, ["auth-1", "auth-2"]);
});

test("receipts show only the last four characters", () => {
  assert.equal(shortReceipt("7XK12345AB4f7k"), "…4F7K");
});
