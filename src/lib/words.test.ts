// Run: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { ringSegments } from "./ring.ts";
import { cleanRecipient, giftFor, initials, recipientFor, recipientLabel, timeLeft } from "./words.ts";

test("a single name becomes a possessive", () => {
  assert.equal(giftFor("Lena"), "Lena's gift");
  assert.equal(giftFor("James"), "James' gift");
});

test("anything else reads 'a gift for …', nothing reads 'a group gift'", () => {
  assert.equal(giftFor("my brother, 30"), "a gift for my brother");
  assert.equal(giftFor(null), "a group gift");
  assert.equal(giftFor("  "), "a group gift");
});

test("initials use the first and last name", () => {
  assert.equal(initials("anna"), "A");
  assert.equal(initials("Anna Maria Schmidt"), "AS");
  assert.equal(initials(""), "?");
});

test("time left counts hours under a day, then days", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  assert.equal(timeLeft("2026-11-10T13:00:00Z", now), "1 hour left");
  assert.equal(timeLeft("2026-11-12T12:00:00Z", now), "2 days left");
  assert.equal(timeLeft("2026-11-10T11:00:00Z", now), "ending now");
});

test("ring segments plus their gaps fill the whole circle", () => {
  for (const n of [2, 3, 5, 10]) {
    const segs = ringSegments(n, 280, 12, 8);
    assert.equal(segs.length, n);
    const [len, rest] = segs[0].dash.split(" ").map(Number);
    assert.ok(Math.abs(len + rest - 2 * Math.PI * segs[0].r) < 1e-6);
    assert.ok(len > 0);
    assert.ok(Math.abs(segs[1].rotate - segs[0].rotate - 360 / n) < 1e-9);
  }
  assert.equal(ringSegments(1, 100, 10, 8)[0].dash.split(" ").map(Number)[1] < 1e-6, true);
});

test("the search detail (age) is dropped from who it's for", () => {
  assert.equal(cleanRecipient("brother, 30"), "brother");
  assert.equal(cleanRecipient("Lena (30)"), "Lena");
  assert.equal(cleanRecipient("mom"), "mom");
});

test("the dialog suggests a name or 'my …', 'our …' only for shared relations", () => {
  assert.equal(recipientLabel("brother, 30", false), "my brother");
  assert.equal(recipientLabel("brother", true), "my brother");
  assert.equal(recipientLabel("colleague", true), "our colleague");
  assert.equal(recipientLabel("Lena, 30", true), "Lena");
  assert.equal(recipientLabel("my mom", false), "my mom");
  assert.equal(recipientLabel("", true), "");
});

test("friends read the organizer's 'my brother' as 'Titus' brother'", () => {
  assert.equal(recipientFor("my brother", "Titus"), "Titus' brother");
  assert.equal(recipientFor("my mom", "Anna"), "Anna's mom");
  assert.equal(recipientFor("our colleague", "Titus"), "our colleague");
  assert.equal(recipientFor("Lena", "Titus"), "Lena");
  assert.equal(giftFor("brother, 30"), "a gift for brother");
});
