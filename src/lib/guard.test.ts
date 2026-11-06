// Run: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, LIMITS, publicOrigin, rateLimit } from "./guard.ts";

const req = (headers: Record<string, string> = {}, url = "http://localhost:10000/api/search") =>
  new Request(url, { method: "POST", headers });

test("APP_URL wins for PayPal return links", () => {
  process.env.APP_URL = "https://gifted.onrender.com/";
  assert.equal(publicOrigin(req({ host: "internal:10000" })), "https://gifted.onrender.com");
  delete process.env.APP_URL;
});

test("behind a proxy the forwarded host and protocol are used", () => {
  const r = req({ host: "internal:10000", "x-forwarded-host": "gifted.onrender.com", "x-forwarded-proto": "https" });
  assert.equal(publicOrigin(r), "https://gifted.onrender.com");
});

test("locally the request origin is used", () => {
  assert.equal(publicOrigin(req({}, "http://localhost:3000/api/checkout")), "http://localhost:3000");
});

test("the first forwarded address is the client", () => {
  assert.equal(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
});

test("one IP is stopped after its hourly limit, another one is not", async () => {
  const a = req({ "x-forwarded-for": "198.51.100.1" });
  for (let i = 0; i < LIMITS.group.perIpPerHour; i++) assert.equal(await rateLimit(a, "group"), null);
  assert.equal((await rateLimit(a, "group"))?.status, 429);
  assert.equal(await rateLimit(req({ "x-forwarded-for": "198.51.100.2" }), "group"), null);
});
