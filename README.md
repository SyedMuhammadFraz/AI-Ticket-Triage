# Fernway Office Supply × Triage Desk

A B2B e-commerce store with an **AI support-triage service integrated into it**, showing how an AI layer
plugs into an existing enterprise platform instead of being a standalone product.

| App | What it is | Port |
| --- | --- | --- |
| [`apps/store`](apps/store) | **Fernway Office Supply**: a fictional B2B store for companies. Catalogue, cart, checkout with contract pricing and Net-30 invoicing, company accounts and order tracking. | 3000 |
| [`apps/triage`](apps/triage) | **Triage Desk**: AI support triage with human approval. It classifies and prioritises tickets, drafts replies only from help articles, and nothing is sent until an agent approves. See [its README](apps/triage/README.md). | 3001 |

The two apps have **separate databases** and talk only through Triage Desk's REST API and signed webhooks, the
same way it would plug into any other company's platform.

> Portfolio demo. Fernway, its customers, products and orders are fictional; no real customer data is used.

## Status

| Session | Scope | Status |
| --- | --- | --- |
| 1 | Monorepo restructure; store foundation: catalogue, search, cart, checkout (contract pricing, PO numbers, Net-30), company accounts, order history and tracking | ✅ Done |
| 2 | Triage Desk as a service: REST API with API keys, signed webhooks (transactional outbox, retries), order context on tickets, help articles and categories rewritten for B2B commerce | ✅ Done |
| 3a | Integration: "Get help with this order" (order context sent to the AI), "Support requests" for buyers with replies delivered by webhook, help centre fed by Triage Desk | ✅ Done |
| 3b | Store back-office (`/admin`) with the support console embedded via single sign-on | Next |
| 4 | End-to-end browser test of the full loop, accuracy report, screenshots, deployment | Planned |

## Getting started

**Prerequisites:** Node.js 22+. No Docker or Postgres install needed: local databases run on embedded Postgres
(PGlite).

```bash
npm install
cp apps/store/.env.example apps/store/.env.local     # then set APP_SECRET (openssl rand -hex 32)
cp apps/triage/.env.example apps/triage/.env.local   # then set APP_SECRET

npm run db:local     # terminal 1: both databases (triage :5433, store :5434), data in .data/
npm run db:migrate   # terminal 2: create tables in both
npm run db:seed      # sample catalogue, companies, orders, help articles and tickets
npm run integration:connect-store -w apps/triage   # API key + webhook secret → apps/store/.env.local
npm run dev          # store → http://localhost:3000 · Triage Desk → http://localhost:3001
```

In the store, use **Sign in** and pick one of the fictional buyers. Each belongs to a company with its own tier
(Starter / Business / Enterprise), contract discount and order history.

## How the integration works

```
 STORE (apps/store)                                        TRIAGE DESK (apps/triage)
 1. Buyer: "Get help with this order"
 2. Saved locally (SR-7001), then sent ── POST /api/v1/tickets ──▶ 3. AI classifies, prioritises, drafts from
    with order + company context        (API key, idempotent       help articles, sees the order context
                                          on externalId)        4. Agent reviews and approves in the console
 6. Buyer sees "Answered" + the reply ◀── signed webhook ─────── 5. ticket.reply_approved (from an outbox row
    in Account → Support requests        (HMAC, 5-min window,      written in the same transaction as the
                                          retried with backoff)     approval)
```

- **Nothing reaches the buyer without an agent's approval:** the reply event is only written when an agent clicks
  Approve.
- **Nothing is lost:** the store saves each request before sending it and retries if Triage Desk is down. Triage
  Desk retries webhook deliveries with exponential backoff and dead-letters them after 7 attempts. Both sides are
  idempotent: the store's reference is the ticket's `externalId`, and each webhook event id is applied once.
- **Each side keeps its own data:** the store owns customers and orders; Triage Desk owns triage, help articles,
  the agent console and the audit log. The only shared secrets are the API key and the webhook signing secret.
- **Production safety:** webhook URLs must be https and may not resolve to private or loopback addresses, and the
  address is checked at connection time, so DNS rebinding can't bypass it. For local testing with
  `next start`, set `WEBHOOK_ALLOW_PRIVATE_NETWORK=true` in Triage Desk.

### Triage Desk API (v1)

| Endpoint | Scope | Notes |
| --- | --- | --- |
| `POST /api/v1/tickets` | `tickets:write` | `{ externalId, customerName, customerEmail, tier, subject, body, context? }`. Returns 201, or 200 if the same `externalId` is sent again; 409 if it's re-sent with different content |
| `GET /api/v1/tickets/:id` | `tickets:read` | Status, triage labels and the approved reply; only tickets created by the same key |
| `GET /api/v1/kb/articles` | `kb:read` | The help centre, so the host can publish the same articles the AI uses |

Auth: `Authorization: Bearer td_live_…` (keys are stored only as SHA-256 hashes). Errors:
`{ "error": { "code", "message", "details?" } }`. Rate limit: 120 requests/minute per key.

Webhook events: `ticket.triaged`, `ticket.reply_approved` (includes the reply) and `ticket.escalated`. Headers:
`Triage-Event-Id`, `Triage-Event-Type` and `Triage-Signature: t=<unix>,v1=<hex HMAC-SHA256("<t>.<body>")>`.

## Scripts (repo root)

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs both apps |
| `npm run db:local` | Starts both local databases |
| `npm run db:migrate` / `db:seed` | Migrate / seed both apps |
| `npm run check` | Typecheck, lint and test both apps |
| `npm run build` | Production build of both apps |

Each app also has its own scripts: `npm run <script> -w apps/store` or `-w apps/triage`.

## Store security highlights

- Prices are always looked up on the server. The cart cookie holds only SKUs and quantities in a strict
  format, so editing it can't change what anything costs.
- Buyers see only their own company's orders; another company's order number returns 404.
- Signed, httpOnly session cookies; redirects after sign-in can only go to local store pages.
- Invoice payment is enforced server-side for Net-30 accounts only.
- Nonce-based Content Security Policy and standard security headers, the same as Triage Desk.
