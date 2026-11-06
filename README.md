# Gifted

**Your AI gift agent. One prompt. One choice. Gift handled.**

An AI shopping agent for the PayPal AI Hackathon 2026. Describe who the gift is for, your budget and
the latest delivery date. The agent finds real products, checks price and delivery against your
constraints, and completes the purchase through PayPal (Sandbox).

> Status: work in progress. Setup and judge testing instructions will follow.

## Stack
- Next.js (App Router, TypeScript, Tailwind)
- Claude API (Haiku 5.5, structured outputs)
- Channel3 (product search)
- PayPal Orders API v2 (Sandbox)

## How it works
1. **Understand:** Claude turns the free-text request into a brief (recipient, interests, budget, deadline) and 2-3 search queries.
2. **Search:** Channel3 is queried in parallel; only in-stock USD offers within the budget (shipping included) remain.
3. **Pick:** Claude picks the 3 best gifts and explains why each one fits.
4. **Buy:** price and stock are checked again with Channel3, shipping comes from our own rules
   (the app is the merchant of record), then a PayPal order is created and captured after approval.

Budget rules: "$80" never goes above $80, "around $80" allows up to $85.
Results are saved in the browser: the same request shows the same ideas, new ones only via "Show other ideas".

## Local setup
```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

Run the tests:
```bash
npm test
```

Check that all API keys work:
```bash
node --env-file=.env.local scripts/check-apis.mjs "gift for coffee lover"
```

## Deployment (Render)
`render.yaml` describes one free Node web service. Render Dashboard -> New -> Blueprint -> this repo,
then enter the secret values once. After the first deploy, set `APP_URL` to the service URL so PayPal
sends buyers back to the right place. Search, group gifts and checkout are rate-limited per IP and per day
(`src/lib/guard.ts`, counters in Upstash).
