// API check: is every key valid, and what does Channel3 actually return?
// Run: node --env-file=.env.local scripts/check-apis.mjs ["search query"]

const query = process.argv[2] ?? "gift for coffee lover who travels";

function header(title) {
  console.log(`\n=== ${title} ===`);
}

async function checkChannel3() {
  header("Channel3");
  const key = process.env.CHANNEL3_API_KEY;
  if (!key) return console.log("SKIP: CHANNEL3_API_KEY missing");

  const res = await fetch("https://api.trychannel3.com/v1/search", {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      query,
      filters: { price: { min_price: 50, max_price: 100 }, availability: ["InStock"] },
      limit: 5,
    }),
  });
  if (!res.ok) return console.log(`FAIL ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const products = data.products ?? [];
  console.log(`OK: ${products.length} products for "${query}"`);
  for (const p of products) {
    const offer = p.offers?.[0];
    console.log(
      `- ${p.title} | ${offer?.price?.price} ${offer?.price?.currency} | ${offer?.price?.availability} | ${offer?.domain} | images: ${p.images?.length ?? 0}`,
    );
  }
  // Full first product, so we can see every field (shipping? delivery?)
  if (products[0]) {
    header("Channel3: first product (raw)");
    console.log(JSON.stringify(products[0], null, 2));
  }
}

async function checkPayPal() {
  header("PayPal Sandbox");
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
  const base = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";
  if (!id || !secret) return console.log("SKIP: PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing");

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return console.log(`FAIL ${res.status}: ${await res.text()}`);
  const token = await res.json();
  console.log(`OK: access token received (expires in ${token.expires_in}s)`);
}

async function checkAnthropic() {
  header("Claude API");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return console.log("SKIP: ANTHROPIC_API_KEY missing");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 20,
      messages: [{ role: "user", content: "Reply with: ok" }],
    }),
  });
  if (!res.ok) return console.log(`FAIL ${res.status}: ${await res.text()}`);
  const msg = await res.json();
  console.log(`OK: ${msg.content?.[0]?.text}`);
}

await checkChannel3();
await checkPayPal();
await checkAnthropic();
