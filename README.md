# Gifted

**Group gifts without chasing anyone for money.**

One prompt finds the gift. Everyone reserves their share with PayPal. Nobody is charged unless everyone
is in.

Group gifts usually end the same way: one person pays, then chases everyone else for weeks. Gifted
turns that around. You describe the person and the group in one sentence ("we're 5 friends, about $25
each"), an AI agent finds three fitting gifts with the price per head, and you share one link. Each
friend reserves their part with PayPal. Only when the last one is in does the agent re-check price and
stock and collect every share at once. If someone drops out, time runs out or the price goes up, every
reservation is released and nobody pays.

Built for the PayPal AI Hackathon 2026.

## Try it in 2 minutes

**Live:** https://gifted-oe27.onrender.com (free hosting: the first visit after a quiet spell can take
about 50 seconds to wake up)

Everything runs on the **PayPal Sandbox**. No real money moves. Use this test buyer to log in at PayPal:

| | |
|---|---|
| Email | `Judge@gmail.com` |
| Password | `Judge123` |

**Group gift (the main flow)**
1. Type a request for several people, e.g. *"We're 5 friends getting something for Lena's 30th. She
   loves climbing and coffee. About $25 each."* (or click the chip "5 friends · Lena's 30th").
2. Pick a gift and click **Start group gift**. Enter your name. Claude writes the invite.
3. On the group page, click **Reserve with PayPal** and log in with the test buyer above. PayPal only
   *reserves* your share (authorization). Nothing is charged yet.
4. Back on the group page, click **Let the others join** (Sandbox demo). Simulated friends take the
   open spots one by one, marked "demo". You can't be expected to log in with five PayPal accounts.
5. When everyone is in, the agent re-checks price and stock, then collects every real share at once
   (capture). You see the steps and the PayPal receipt. If the price had gone up or the gift had sold
   out, every reservation would have been released instead: nobody pays.

Want to see it live in two windows? Open the group link in a second (private) window before step 4:
it refreshes every 3 seconds.

**Buy it alone:** click **Buy it alone** on any gift card, log in with the same test buyer and approve.
Payment is captured right away and you land on the order confirmation.

**Good to know**
- Sharing the group link in a chat shows a preview image with the ring and the price per person.
- Requests in other languages work too (results are in English, prices in USD).
- Search, group gifts and checkout are rate-limited per IP and per day to protect the API budget.

**Limitations:** Gifted collects the money as merchant of record. Placing the order with the shop is
the next step; shipping costs and delivery dates follow our own demo rules.

## How it works

**1. Find (Claude + Channel3)**
- Claude turns the free-text request into a brief: who it's for, interests, occasion, deadline, group
  size and budget per head ("5 friends, $25 each" becomes a $125 total). If something important is
  missing, it asks one short question.
- Channel3 is searched with 2-3 queries in parallel. Only in-stock USD offers that fit the budget with
  shipping included remain.
- Claude picks the three best gifts and says why each one fits. Cards show the price per person.

**2. Everyone reserves (PayPal Orders API, `intent: AUTHORIZE`)**
- Starting a group gift fetches price and stock fresh, splits the total into exact shares (they add up
  to the cent) and lets Claude write the invite for the group chat.
- Each friend opens the shared link and reserves their share with PayPal. The money is authorized, not
  taken. A group stays open for 3 days, as long as PayPal honors an authorization.
- The group page refreshes itself, so every open window sees the ring fill up.

**3. Charged only when all are in (capture, refund, void)**
- When the last share is reserved, the agent checks the gift again before anyone pays.
  Price went up or sold out: every reservation is voided, nobody pays. Cheaper now: everyone pays their
  share of the new price, never more than they reserved.
- Then every share is captured. If one capture fails, shares already collected are refunded in full and
  the rest are released. The group never ends half paid.
- Time ran out: every reservation is released.

**Buy it alone:** a single gift goes through a regular PayPal checkout (`intent: CAPTURE`).

Shared group links show a generated preview image (the share ring with the gift and how many are in).

## Stack
- Next.js 16 (App Router, Cache Components, TypeScript, Tailwind CSS 4)
- Claude API with structured outputs: brief, gift picks, invite
- Channel3 for product search and fresh price checks
- PayPal Orders API v2 and Payments API (authorize, capture, refund, void), Sandbox
- Upstash Redis for group gifts and rate limits
- Render (free web service, `render.yaml`)

The core rules have tests (`npm test`): budget and shares, shipping and delivery, closing a group
(price changes, failed captures, refunds, demo friends), rate limits.

## Local setup
```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

You need keys for Claude, Channel3, a PayPal Sandbox app and Upstash Redis (links in `.env.example`).
Without Upstash, group gifts are stored as files in `.dev-groups/` (local only).

Run the tests:
```bash
npm test
```

Check that all API keys work:
```bash
node --env-file=.env.local scripts/check-apis.mjs "gift for coffee lover"
```

## Deployment (Render)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/iblametitus/gifted)

`render.yaml` describes one free Node web service. Use the button above (or Render Dashboard -> New ->
Blueprint -> this repo), then enter the secret values once. After the first deploy, set `APP_URL` to the service URL so PayPal
sends buyers back to the right place. Search, group gifts and checkout are rate-limited per IP and per day
(`src/lib/guard.ts`, counters in Upstash).

## License
MIT
