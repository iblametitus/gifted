// Run: npm test  (Node's built-in test runner, no extra dependencies)

import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetRange } from "./budget.ts";
import type { Product } from "./channel3.ts";
import { quote } from "./shipping.ts";

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

test("delivery skips weekends", () => {
  // Thu 2026-11-05 + 5 business days -> Thu 2026-11-12
  assert.equal(quote(product(80), new Date("2026-11-05T12:00:00Z")).deliveryBy, "2026-11-12");
  // Fri 2026-11-06 + 5 business days -> Fri 2026-11-13
  assert.equal(quote(product(80), new Date("2026-11-06T12:00:00Z")).deliveryBy, "2026-11-13");
});
