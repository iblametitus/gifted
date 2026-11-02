# Gift Agent

**One prompt. One choice. Gift handled.**

An AI shopping agent for the PayPal AI Hackathon 2026. Describe who the gift is for, your budget and
the latest delivery date. The agent finds real products, checks price and delivery against your
constraints, and completes the purchase through PayPal (Sandbox).

> Status: work in progress. Setup and judge testing instructions will follow.

## Stack
- Next.js (App Router, TypeScript, Tailwind)
- Claude API (agent with tool use)
- Channel3 (product search)
- PayPal Orders API v2 (Sandbox)

## Local setup
```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

Check that all API keys work:
```bash
node --env-file=.env.local scripts/check-apis.mjs "gift for coffee lover"
```
