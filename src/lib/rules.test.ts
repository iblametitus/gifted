// Run: npm test  (Node's built-in test runner, no extra dependencies)

import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetRange, resolveBudget } from "./budget.ts";
import type { Product } from "./channel3.ts";
import { splitShares } from "./shares.ts";
import { cartQuote, quote, withFreshDelivery } from "./shipping.ts";

test("'$80' is a hard limit", () => {
  assert.deepEqual(budgetRange({ budgetUsd: 80, approximate: false, minUsd: null }), { min: 48, max: 80 });
});

test("'around $80' allows up to 85", () => {
  assert.equal(budgetRange({ budgetUsd: 80, approximate: true, minUsd: null }).max, 85);
});

test("an explicit lower bound is kept", () => {
  assert.deepEqual(budgetRange({ budgetUsd: 80, approximate: false, minUsd: 50 }), { min: 50, max: 80 });
});

test("no budget means no limits", () => {
  assert.deepEqual(budgetRange({ budgetUsd: null, approximate: false, minUsd: null }), { min: null, max: null });
});

const fromText = { budgetUsd: 80, approximate: true, minUsd: null };
const noText = { budgetUsd: null, approximate: false, minUsd: null };

test("the budget field wins over the text", () => {
  assert.deepEqual(resolveBudget({ budgetUsd: 50 }, fromText), { min: 30, max: 50, source: "field" });
  assert.equal(resolveBudget({ budgetUsd: 50, budgetApprox: true }, fromText).max, 53);
});

test("the text budget is used when the field is empty", () => {
  assert.deepEqual(resolveBudget({}, fromText), { min: 48, max: 85, source: "text" });
});

test("no budget anywhere -> $100 assumed", () => {
  assert.deepEqual(resolveBudget({}, noText), { min: 60, max: 100, source: "assumed" });
});

const product = (price: number, weightLb: number | null = null) => ({ price, weightLb }) as Product;

test("shipping is free from $75", () => {
  assert.equal(quote(product(75)).shipping, 0);
  assert.equal(quote(product(80)).total, 80);
});

test("shipping below $75 depends on weight", () => {
  assert.equal(quote(product(40)).shipping, 5.99); // unknown weight
  assert.equal(quote(product(40, 3)).shipping, 9.99);
  assert.equal(quote(product(40, 8)).shipping, 14.99);
  assert.equal(quote(product(19.99)).total, 25.98);
});

test("a cart ships once: free from $75 in total", () => {
  assert.deepEqual(
    { ...cartQuote([product(40), product(40)]), deliveryBy: "-" },
    { subtotal: 80, shipping: 0, total: 80, deliveryBy: "-" },
  );
});

test("a small cart pays the rate of its heaviest item, once", () => {
  const q = cartQuote([product(20), product(30, 3)]);
  assert.equal(q.shipping, 9.99);
  assert.equal(q.total, 59.99);
});

test("an empty cart costs nothing", () => {
  assert.equal(cartQuote([]).total, 0);
});

test("delivery skips weekends", () => {
  // Thu 2026-11-05 + 5 business days -> Thu 2026-11-12
  assert.equal(quote(product(80), new Date("2026-11-05T12:00:00Z")).deliveryBy, "2026-11-12");
  // Fri 2026-11-06 + 5 business days -> Fri 2026-11-13
  assert.equal(quote(product(80), new Date("2026-11-06T12:00:00Z")).deliveryBy, "2026-11-13");
});

test("saved ideas get today's delivery date but keep their price", () => {
  const savedThursday = { id: "x", quote: quote(product(80), new Date("2026-11-05T12:00:00Z")) };
  const [shownFriday] = withFreshDelivery([savedThursday], new Date("2026-11-06T12:00:00Z"));
  assert.equal(shownFriday.quote.deliveryBy, "2026-11-13");
  assert.equal(shownFriday.quote.total, savedThursday.quote.total);
  assert.equal(savedThursday.quote.deliveryBy, "2026-11-12"); // original untouched
});

test("group shares add up to the exact total", () => {
  assert.deepEqual(splitShares(100, 3), [33.34, 33.33, 33.33]);
  assert.deepEqual(splitShares(79.95, 4), [19.99, 19.99, 19.99, 19.98]);
  assert.deepEqual(splitShares(80, 1), [80]);
  const shares = splitShares(66.99, 5);
  assert.equal(Math.round(shares.reduce((a, b) => a + b, 0) * 100), 6699);
});
