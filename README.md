# Nitrogen

> Shopify apps on Firebase. Inert by design — no framework, no server, nothing running while nobody is using it.
>
> Hydrogen is the fuel. Oxygen is the oxidiser. **Nitrogen is the 78% of the atmosphere that everything else just runs inside.**

[![npm version](https://img.shields.io/npm/v/%40mksd0398%2Fnitrogen.svg)](https://www.npmjs.com/package/@mksd0398/nitrogen)
[![Downloads](https://img.shields.io/npm/dm/%40mksd0398%2Fnitrogen.svg)](https://www.npmjs.com/package/@mksd0398/nitrogen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

```bash
npx @mksd0398/nitrogen my-app
```

<p align="center">
  <img src="https://img.shields.io/badge/Shopify-2026--07-7AB55C?logo=shopify&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-v2%20Functions-FFCA28?logo=firebase&logoColor=black" />
  <img src="https://img.shields.io/badge/Node-24-339933?logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-Functions-3178C6?logo=typescript&logoColor=white" />
</p>

---

## Table of Contents

- [What is this?](#what-is-this)
- [Quick Start](#quick-start)
- [Why Firebase?](#why-firebase)
- [What's Inside](#whats-inside)
- [Architecture](#architecture)
- [Writing an API](#writing-an-api)
- [Security](#security)
- [Multi-tenancy](#multi-tenancy)
- [Rate Limits](#rate-limits)
- [What It Costs](#what-it-costs)
- [CLI Usage](#cli-usage)
- [Development](#development)
- [Extending Your App](#extending-your-app)
- [GDPR Compliance](#gdpr-compliance)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Related](#related)
- [License](#license)

---

## What is this?

The **Firebase alternative** to `shopify app init`. Instead of Remix + Prisma + a server, you get:

- **Firebase v2 Cloud Functions** (gen 2, Node 24) — one function per API resource, each scaling on its own
- **Cloud Firestore** for sessions and app data
- **Firebase Hosting** for the embedded admin dashboard
- **Polaris web components + App Bridge** — 5 pages, no React, no build step
- **Theme App Extension** for storefront UI (works on all Shopify plans)
- **Shopify API 2026-07** — token exchange, OAuth, session tokens, webhooks, GDPR handlers
- **Multi-tenant** — many shops per app, and several Shopify apps on one backend
- **API keys** for callers outside Shopify — hashed at rest, scoped, per tenant
- **A test suite in every generated project** — `npm test` covers auth, webhooks, routing and wiring

One command does the whole thing: signs you in to Shopify, creates the app, creates
and provisions the Firebase project, stores the client secret in Secret Manager,
deploys, and hands you an install link. No copying Client IDs between dashboards,
and no pasting your Client Secret — the CLI reads it from the Shopify CLI itself.

---

## Quick Start

### Prerequisites

The CLI checks all of these before it does anything, and offers to install what's missing.

| Tool | Install | Required? |
|------|---------|-----------|
| Node.js 20+ | [nodejs.org](https://nodejs.org/) | Yes — Cloud Functions run on Node 24 |
| Firebase CLI | `npm i -g firebase-tools` | Yes — offered automatically if missing |
| Shopify CLI | `npm i -g @shopify/cli` | Yes — offered automatically if missing |
| git | [git-scm.com](https://git-scm.com/) | Optional — only for the initial commit |
| gcloud | [Cloud SDK](https://cloud.google.com/sdk) | Optional — auto-enables the Firestore API |

You also need a **Shopify Partner account** and a **Google account**. The CLI signs
you in to both; you don't need to open either dashboard first.

> **Cloud Functions and Secret Manager require the Firebase Blaze plan.** Blaze
> includes the free tier described in [What It Costs](#what-it-costs), but a
> billing account has to be attached. That is the one step the CLI cannot do for you.

### 1. Run the scaffold

```bash
npx @mksd0398/nitrogen my-app
```

The CLI walks the entire flow:

```
  🛍️  +  🔥  Nitrogen

  === Environment Check ===

  ✔ Node.js        v22.20.0
  ✔ npm            10.9.4
  ✔ git            2.47.1
  ✔ Firebase CLI   15.10.0
  ✔ Shopify CLI    4.6.0
  ✔ gcloud         565.0.0
  ✔ Environment ready

  === Sign In to Shopify ===

  ℹ A browser window opens — approve the code shown below.
  ✔ Signed in to Shopify

  === Choose Your Template ===

  ? What would you like to create?
    ❯ Shopify + Firebase app (full-stack serverless)
      Extension-only app (Shopify CLI)

  === Project Setup ===

  ? Language for Cloud Functions        › TypeScript
  ? What API access does your app need? › read_products

  === Create Your Shopify App ===

    (the Shopify CLI asks which organization, and lets you create a new app)
  ✔ Client ID:     12dfc4d0d6d0b40d85b0f64b80de28af
  ✔ Client Secret: shpss_09**************(38 chars)

  === Firebase Setup ===

  ? Select a Firebase project
    ❯ [create a new project]

  ? Where should your database live?       › europe-west1
  ✔ Firestore: europe-west1
  ✔ Hosting: https://my-store-app.web.app
  ? Where should your app's functions run? › europe-west1  (next to your database)
  ✔ Functions region: europe-west1
  ✔ App config written — https://my-store-app.web.app

  === Going Live ===

  ✔ Client Secret stored in Secret Manager
  ✔ Deployed to Firebase
  ✔ Shopify app updated

  ✔  All done! Your Shopify + Firebase app is ready.
```

**You never paste the Client Secret.** The CLI reads it from `shopify app env show`
once the app exists — which is exactly why the Shopify app is created *before* Firebase.

### 2. Install it on a development store

Install the app from your Partner Dashboard (**Apps → your app → Test on
development store**). Shopify installs it and opens it embedded in the admin; the
app obtains its access token by token exchange on the first request.

The legacy OAuth link also works:

```
https://YOUR-PROJECT.web.app/auth?shop=YOUR-STORE.myshopify.com
```

### 3. Make changes

```bash
cd my-store-app
# edit web/ or functions/src/
cd functions && npm test && cd ..
firebase deploy --force
```

---

## Why Firebase?

Nothing runs while nobody is using your app. Every function scales to zero, so an
app with no traffic costs nothing, and a small app fits inside the free tier.
[What It Costs](#what-it-costs) has the arithmetic.

| | `shopify app init` (Remix) | **Nitrogen** |
|---|---|---|
| **Backend** | One Remix server | Firebase v2 Cloud Functions, one per API resource |
| **Database** | Prisma + PostgreSQL | Cloud Firestore |
| **Frontend** | React + Polaris | Polaris web components + App Bridge (no build) |
| **Hosting** | Vercel / Fly.io / Heroku | Firebase Hosting |
| **Auth** | `@shopify/shopify-app-react-router` | Four verifiers in one file, `verify.ts` — you own it |
| **Secrets** | Host environment variables | Google Secret Manager |
| **Build** | Vite | `tsc` (no bundler), or nothing for JavaScript |
| **Deploy** | Varies | Done for you — the CLI deploys before it exits |
| **Idle cost** | A server that is always on | Zero — everything scales to zero |
| **Scaling** | Single server | Per-function (Cloud Run), capped by `maxInstances` |
| **GDPR webhooks** | Auto-handled | Included, `shop/redact` implemented |
| **Theme extensions** | Supported | Supported (same Shopify format) |

### When to use this

- Custom apps for one merchant, or one app per brand on a shared backend
- Public apps with a straightforward admin UI
- Teams already on Firebase / Google Cloud
- You want to be able to read every line your app runs

### When to use Remix instead

- Admin UIs that need Polaris React and client-side state
- A team already invested in Remix
- You need server-side rendering for app pages

---

## What's Inside

```
my-app/
├── shopify.app.toml              # Shopify app config (API 2026-07)
├── firebase.json                 # Hosting rewrites, headers, functions, Firestore
├── firestore.rules               # Deny-all: only Cloud Functions touch the data
│
├── functions/                    # ── Backend ──
│   ├── src/
│   │   ├── index.ts              # THE API SURFACE: one export per function
│   │   ├── http.ts               # endpoint(): auth, rate limit, routing, errors
│   │   ├── verify.ts             # Every Shopify signature check, fail-closed
│   │   ├── config.ts             # App registry, secrets, region
│   │   ├── auth.ts               # OAuth, token exchange, sessions
│   │   ├── shopify.ts            # Admin GraphQL client
│   │   ├── api-keys.ts           # Keys for callers outside Shopify
│   │   ├── webhooks.ts           # Webhook handlers
│   │   ├── proxy.ts              # Storefront App Proxy routes
│   │   ├── firebase.ts           # Firebase Admin SDK init
│   │   └── api/                  # One file per resource
│   │       ├── shop.ts           #   GET  /api/shop
│   │       ├── products.ts       #   GET  /api/products/search, /api/products/:id
│   │       ├── settings.ts       #   GET, POST /api/settings
│   │       ├── keys.ts           #   GET, POST /api/keys, DELETE /api/keys/:id
│   │       └── status.ts         #   GET  /api/status   (session OR API key)
│   ├── test/                     # npm test — no emulator or network needed
│   ├── .env                      # Client id, URL, scopes, region (git-ignored)
│   └── .secret.local             # Client secret, for the emulator only (git-ignored)
│
├── web/                          # ── Frontend (5 pages) ──
│   ├── index.html                # Dashboard
│   ├── products.html             # Product search + detail
│   ├── settings.html             # Form persisted to Firestore
│   ├── keys.html                 # Create and revoke API keys
│   ├── polaris.html              # Polaris component reference
│   ├── js/app.js                 # apiFetch (session token + one 401 retry), toast
│   ├── js/pages/                 # One module per page
│   └── css/app.css
│
└── extensions/                   # ── Storefront ──
    └── theme-block/
```

JavaScript projects have the same files with `.js`.

---

## Architecture

```
  Shopify admin (iframe)        Storefront            Shopify          Outside systems
  web/ + App Bridge             theme / App Proxy     webhooks         mobile app, script
        │                            │                   │                   │
        │ session token              │ signature         │ HMAC              │ API key
        ▼                            ▼                   ▼                   ▼
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │  Firebase Hosting — HTTPS only, rewrites each path to one function                 │
  └──────────────────────────────────────────────────────────────────────────────────┘
        │                            │                   │                   │
        ▼                            ▼                   ▼                   ▼
  ┌───────────┐ ┌───────────┐  ┌───────────┐      ┌───────────┐       ┌───────────┐
  │ shop      │ │ products  │  │ proxy     │      │ webhooks  │       │ status    │
  │ settings  │ │ keys      │  │           │      │ auth      │       │           │
  └───────────┘ └───────────┘  └───────────┘      └───────────┘       └───────────┘
   Each box is its own Cloud Run service: own scaling, memory, timeout, logs, deploy.
        │                                                │
        ▼                                                ▼
  ┌──────────────────────────────┐          ┌──────────────────────────────┐
  │  Cloud Firestore             │          │  Secret Manager              │
  │  shopSessions  access tokens │          │  SHOPIFY_API_SECRET          │
  │  appSettings   per tenant    │          │  mounted into each function  │
  │  apiKeys       sha256 only   │          └──────────────────────────────┘
  │  authNonces    OAuth state   │
  └──────────────────────────────┘
```

### The functions

| Function | Path | Caller | Verified by |
|---|---|---|---|
| `auth` | `/auth`, `/auth/callback` | Browser, during a legacy install | OAuth HMAC + single-use nonce |
| `webhooks` | `/webhooks` | Shopify | HMAC over the raw body |
| `proxy` | `/proxy/**` | Storefront, through the App Proxy | Query signature |
| `shop` | `/api/shop` | Embedded admin | Session token |
| `products` | `/api/products/**` | Embedded admin | Session token |
| `settings` | `/api/settings` | Embedded admin | Session token |
| `keys` | `/api/keys/**` | Embedded admin | Session token |
| `status` | `/api/status` | Embedded admin or an outside system | Session token or API key |

### Why one function per resource

A single Express app behind `/api/**` is one Cloud Run service: every route shares
its instances, its memory ceiling, its timeout and its fate. One slow route — a CSV
import, a report — starves everything else, including the routes merchants are
waiting on.

One function per resource means each one scales, fails, times out and deploys on
its own, and a heavy resource can be given more memory without paying for it
everywhere.

What it costs you:

- One export and one or two rewrites per resource. `npm test` checks they agree.
- A cold start per function rather than one for the whole API.
- Instance caches are per function.
- Shared modules are bundled into every function, so after changing one, deploy
  them all with `firebase deploy --only functions`.

Routes that belong together stay together: `products` serves both search and
detail. Split further only when a route needs different resources or must not
share fate with its neighbours.

---

## Writing an API

An API is three things that must agree. Say the resource is `orders`.

**1. The routes — `functions/src/api/orders.ts`**

```typescript
import { endpoint, HttpError } from "../http";
import { graphql } from "../shopify";

export default endpoint({
  "GET /api/orders": async (ctx) => {
    const data = await graphql(ctx, `{ orders(first: 10) { nodes { id name } } }`);
    return { orders: data.orders.nodes };
  },

  "GET /api/orders/:id": async (ctx) => {
    if (!/^\d+$/.test(ctx.params.id)) throw new HttpError(400, "Invalid order id");
    const data = await graphql(
      ctx,
      `query ($id: ID!) { order(id: $id) { id name } }`,
      { id: `gid://shopify/Order/${ctx.params.id}` },
    );
    if (!data.order) throw new HttpError(404, "Order not found");
    return { order: data.order };
  },
});
```

A route **returns** the JSON to send, or **throws** `HttpError`. Anything else
thrown becomes a `500` whose detail stays in the logs.

**2. The export — `functions/src/index.ts`**

```typescript
import ordersApi from "./api/orders";

export const orders = onRequest(base, ordersApi);
```

This line is what creates the Cloud Function. `index.ts` is the whole API surface:
if it is not exported there, it does not exist.

**3. The rewrites — `firebase.json`**

```json
{ "source": "/api/orders", "run": { "serviceId": "orders", "region": "europe-west1" } },
{ "source": "/api/orders/**", "run": { "serviceId": "orders", "region": "europe-west1" } }
```

Then:

```bash
cd functions && npm test     # fails if the export and the rewrites disagree
firebase deploy --only functions:orders,hosting
```

### What a route receives

| `ctx` | |
|---|---|
| `ctx.shop` | The shop, e.g. `demo.myshopify.com`. From the verified credential, never from the request. |
| `ctx.app` | The Shopify app the caller belongs to (see [Multi-tenancy](#multi-tenancy)). |
| `ctx.userId` | Staff user id, for session callers. |
| `ctx.apiKey` | The key used, for API-key callers. |
| `ctx.params` | Path parameters, decoded. |
| `ctx.query`, `ctx.body` | Query string and parsed JSON body. **Validate them** — they are caller input. |
| `ctx.req`, `ctx.res` | The raw request and response, when you need them. |

### Who may call it

```typescript
endpoint(routes)                                  // the embedded admin
endpoint(routes, { apiKey: "read" })              // ...and API keys with the "read" scope
endpoint(routes, { auth: "proxy" })               // the storefront, via the App Proxy
endpoint(routes, { rateLimit: { max: 30, windowSeconds: 60 } })
```

### A resource that needs more

```typescript
export const imports = onRequest(
  { ...base, memory: "1GiB", timeoutSeconds: 60 },
  importsApi,
);
```

### Traps

Each of these cost real time in production.

| Trap | What happens |
|---|---|
| `serviceId` is the export name **lowercased** | `orderSync` deploys as `ordersync`. A camelCase `serviceId` makes Hosting refuse to finalize. |
| Region mismatch between function and rewrite | The deploy succeeds. Hosting serves 404. |
| Dropping `invoker: "public"` | An update serves Google's own 403 page, which reads exactly like a CORS bug. |
| Hosting cuts a rewritten request at **60 seconds** | Whatever `timeoutSeconds` says. Long work is chunked by the client, or queued. |
| `--only functions:a` after changing a shared module | Every other function stays on the old code. |
| Removing a function from `index.ts` | A non-interactive deploy refuses. Run `firebase functions:delete <name> --region <region> --force` first. |
| Work started after the response is sent | Gen 2 throttles CPU once the response is delivered. Await it, or queue it. |

---

## Security

| Entry point | Check | Fails closed when |
|---|---|---|
| Webhooks | HMAC-SHA256 over the raw body, timing-safe | The header or the body is missing, the HMAC is wrong, or the shop domain is malformed |
| Admin API | App Bridge session token: HS256, `aud`, `exp`, `nbf`, issuer | Any claim is wrong, or the token is more than 10 seconds past expiry |
| App Proxy | Signature over the sorted query string | The signature is missing or wrong |
| OAuth callback | HMAC, then a single-use nonce bound to the shop and the app, 10-minute life | The nonce is unknown, expired, replayed, or belongs to another shop or app |
| API keys | sha256 lookup, scope, active flag | The key is unknown, revoked, or carries another scope |

Also:

- **The client secret is in Secret Manager**, not `functions/.env`. Everything in
  `functions/` is baked into the deployed container; `.gitignore` has no say in that.
- **Firestore rules deny everything.** Only Cloud Functions, through the Admin SDK,
  read or write. A browser can never reach `shopSessions`.
- **Shop domains are validated** against `*.myshopify.com` before they reach a
  redirect, an outbound URL or a document id.
- **Errors do not leak.** A route's unexpected exception is logged and answered
  with `Internal server error`.
- **API keys are stored as a hash.** The raw key exists only in the response that
  created it.
- **Hosting is HTTPS only** and sends `Content-Security-Policy: frame-ancestors`
  limited to Shopify, `X-Content-Type-Options: nosniff`, and `Cache-Control:
  no-cache` for JS and CSS so a deploy never runs new HTML against old scripts.

> [!IMPORTANT]
> **Apps scaffolded before 3.1.0 accept unsigned webhooks.** The check was
> `if (req.rawBody && hmac && !verify(...))`, so a request with *no* HMAC header
> skipped verification. An unsigned `app/uninstalled` POST naming any shop deleted
> that shop's access token. If you have such an app, replace the check in
> `functions/src/webhooks` with:
>
> ```js
> const ok = hmac && req.rawBody ? verifyWebhookHmac(req.rawBody, hmac) : false;
> if (!ok) { res.status(401).send("Unauthorized"); return; }
> ```

---

## Multi-tenancy

There are two axes, and they are different things.

**Shops.** One app, many stores. Every document is keyed by the shop, and the shop
always comes from a verified credential. This is on from the first install.

**Apps.** Several Shopify apps — one per brand, say — on the same functions and
the same Firestore. `functions/src/config.ts` holds the registry:

```typescript
export const APPS = [
  { key: "default", clientIdEnv: "SHOPIFY_API_KEY", appUrlEnv: "APP_URL",
    secret: defineSecret("SHOPIFY_API_SECRET") },
  { key: "brand-b", clientIdEnv: "BRAND_B_API_KEY", appUrlEnv: "BRAND_B_APP_URL",
    secret: defineSecret("SHOPIFY_API_SECRET_BRAND_B") },
];
```

### The rule: the app is never read from the caller

| Entry point | The app is |
|---|---|
| Webhook | The one whose secret verifies the HMAC |
| App Proxy | The one whose secret verifies the signature |
| OAuth callback | The one whose secret verifies the HMAC, which must match the nonce |
| Session token | Chosen by `aud`, then verified with that app's secret **and** audience, so the choice is covered by the signature |
| API key | The app that created the key |

A storefront cannot ask for another brand's answer because it cannot sign as the
other app. A `brand` parameter would be forgeable; a signature is not.

### Where tenants live

A tenant is a shop under one app. Its document id is the shop domain for the
default app, and `shop__appkey` for every other app, so data written before a
second app existed needs no migration.

| Collection | Document id | Holds |
|---|---|---|
| `shopSessions` | tenant | Access token, scopes, the app that stored it |
| `appSettings` | tenant | The settings form |
| `apiKeys` | sha256 of the key | Name, scope, tenant, last use |
| `authNonces` | the nonce | Shop, app, expiry |

### Adding a second app

1. Add it to `APPS`, and its client id and URL to `functions/.env`.
2. Create its secret **before** deploying — every function mounts every app's
   secret, and a missing one fails the deploy:
   `firebase functions:secrets:set SHOPIFY_API_SECRET_BRAND_B`
3. Give it its own Hosting site. App Bridge reads the client id from
   `<meta name="shopify-api-key">` before any script runs, so the pages cannot
   choose a key at run time: copy `web/` with the other client id, and add a
   second `hosting` entry to `firebase.json` with the same rewrites.
4. Keep its `shopify.app.toml` in its own directory. The Shopify CLI pins one
   config per directory.
5. Deploy functions and hosting.

The CLI scaffolds one app. Steps 3 and 4 are manual.

---

## Rate Limits

Four layers, each stopping a different failure.

| Layer | Where | Limit | Stops |
|---|---|---|---|
| **Instance cap** | `setGlobalOptions({ maxInstances: 10 })` in `index.ts` | 10 instances per function | A traffic spike or retry storm turning into an unbounded bill |
| **Per-caller limit** | `endpoint()` | 300 requests/minute per tenant; 60/minute per API key | A runaway loop, a leaked key |
| **Shopify's limit** | `graphql()` | Shopify's `429` or `THROTTLED` is passed on as `429` with `Retry-After` | Hammering a shop that is already throttled |
| **Key usage writes** | `api-keys.ts` | `lastUsedAt` written at most once a minute per key | A write per API call |

Override per function:

```typescript
endpoint(routes, { rateLimit: { max: 30, windowSeconds: 60 } })
endpoint(routes, { rateLimit: false })
```

The per-caller limit is counted in memory, per instance, so its real ceiling is
`maxInstances × max`. That is enough to stop a loop or a leaked key. If you need a
hard global limit, count in a shared store.

Storefront (`proxy`) traffic has no per-caller limit: every shopper of a store
arrives as the same tenant, from Shopify's own addresses, so there is nothing fair
to count by. The instance cap covers it.

### Work that must not run on the request

Webhooks have 5 seconds, Hosting cuts at 60, and gen 2 throttles CPU after the
response. Work that outlives a request belongs on a queue, and the queue is where
you throttle the load you put on someone else's API:

```typescript
import { onTaskDispatched } from "firebase-functions/v2/tasks";

export const syncWorker = onTaskDispatched(
  {
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 60 },
    rateLimits: { maxConcurrentDispatches: 4, maxDispatchesPerSecond: 2 },
  },
  async (req) => { /* one unit of work */ },
);
```

Enqueue with `getFunctions().taskQueue("syncWorker").enqueue(data)`. Not scaffolded
by default: it needs the Cloud Tasks API and only matters once you have such work.

---

## What It Costs

Blaze is pay-as-you-go **with** a free tier. You pay only for what exceeds it.
Prices below are Google's list prices for US regions at the time of writing; they
differ by region and change, so check the
[Firestore](https://cloud.google.com/firestore/pricing),
[Cloud Run](https://cloud.google.com/run/pricing) and
[Firebase](https://firebase.google.com/pricing) pages.

### The free tier

| Resource | Free | Then |
|---|---|---|
| Firestore reads | 50,000 / day | $0.06 per 100,000 |
| Firestore writes | 20,000 / day | $0.18 per 100,000 |
| Firestore deletes | 20,000 / day | $0.02 per 100,000 |
| Firestore storage | 1 GiB | $0.18 per GiB-month |
| Function requests | 2,000,000 / month | $0.40 per 1,000,000 |
| Function CPU | 180,000 vCPU-seconds / month | $0.000024 per vCPU-second |
| Function memory | 360,000 GiB-seconds / month | $0.0000025 per GiB-second |
| Hosting transfer | 360 MB / day | $0.15 per GB |
| Secret Manager | 6 secret versions, 10,000 accesses / month | $0.06 per version, $0.03 per 10,000 |

### What each operation uses

Counted from the code in the template. `npm test` exercises every one of them.

| Operation | Function calls | Reads | Writes | Deletes |
|---|---|---|---|---|
| Load a page (HTML, JS, CSS) | 0 | 0 | 0 | 0 |
| Verify a session token, webhook or proxy signature | — | 0 | 0 | 0 |
| `GET /api/shop`, product search, product detail | 1 | 0 or 1 ¹ | 0 | 0 |
| A shop's very first API call (token exchange) | 1 | 1 | 1 | 0 |
| `GET /api/settings` | 1 | 1 | 0 | 0 |
| `POST /api/settings` | 1 | 1 | 1 | 0 |
| `GET /api/keys` | 1 | 1 per key, minimum 1 ² | 0 | 0 |
| `POST /api/keys` | 1 | 1 per existing key, minimum 1 ² | 1 | 0 |
| `DELETE /api/keys/:id` | 1 | 1 | 1 | 0 |
| A call made with an API key | 1 | 1 or 2 ¹ | 0 or 1 ³ | 0 |
| Webhook `app/uninstalled` | 1 | 0 | 0 | 1 |
| Webhook `shop/redact` | 1 | 0 | 0 | 2 |
| Webhook `customers/*` | 1 | 0 | 0 | 0 |
| Legacy OAuth install | 2 | 1 | 2 | 1 |
| Storefront `GET /proxy/hello` | 1 | 0 | 0 | 0 |

¹ The access token is cached in the instance for 5 minutes, so a busy shop costs
one read per 5 minutes per function instance, not one per request.
² A query that matches nothing is still billed one read.
³ `lastUsedAt` is written at most once a minute per key.

### How far the free tier goes

**Function CPU runs out first**, not Firestore and not the request count. A request
that calls the Shopify Admin API spends most of its time waiting on Shopify, and
that wait is billed.

Assume one active store makes **10 API calls a day**, each billed **0.5 seconds**
at 1 vCPU and 256 MiB, and causes **3 reads** and **0.2 writes**:

| Resource | Free per day | One store-day | Stores per day |
|---|---|---|---|
| Function CPU | 6,000 vCPU-seconds | 5 vCPU-seconds | **1,200** |
| Function memory | 12,000 GiB-seconds | 1.25 GiB-seconds | 9,600 |
| Function requests | 66,666 | 10 | 6,666 |
| Firestore reads | 50,000 | 3 | 16,666 |
| Firestore writes | 20,000 | 0.2 | 100,000 |

**About 1,200 daily active stores fit in the free tier** under those assumptions.
At a 20% daily active rate that is roughly 6,000 installed stores.

This is the conservative figure: it bills every request as if it had an instance
to itself. Requests that overlap on one instance share its billed time, so real
usage at volume is lower. Measure yours in Cloud Run's metrics and redo the sum.

### Beyond the free tier

One thousand requests of 0.5 seconds cost about **$0.013**: $0.012 of CPU, $0.0003
of memory, $0.0004 of request fee.

| Daily active stores | Requests / month | Functions | Firestore | **Total / month** |
|---|---|---|---|---|
| 1,200 | 360,000 | $0 | $0 | **$0** |
| 5,000 | 1,500,000 | ~$14 | $0 | **~$14** |
| 10,000 | 3,000,000 | ~$32 | $0 | **~$32** |
| 50,000 | 15,000,000 | ~$185 | ~$2 | **~$187** |
| 100,000 | 30,000,000 | ~$375 | ~$5 | **~$380** |

Functions are the bill. Firestore stays near zero because verifying a request costs
no reads and the access token is cached.

### What actually produces a large bill

Not traffic. Work over a whole collection:

- **Exports, imports, sync jobs and backfills.** One pass over 500,000 documents is
  500,000 reads — ten days of free tier in one run.
- **`getAll()` with ids that may not exist.** It bills a read for every id handed
  to it, found or not. A `documentId() in [...]` query bills only what exists.
- **Webhooks you subscribe to.** `orders/create` on a busy store is one function
  call per order, plus whatever your handler reads and writes.
- **Reading the same document repeatedly in one request.** Read it once, pass it down.

Two things to know when you read the invoice:

- **Firestore is billed under the "App Engine" service line.** It looks like a stray
  App Engine app. It is your database.
- **Firebase alerts, it does not cap.** Set a
  [budget alert](https://cloud.google.com/billing/docs/how-to/budgets) on day one.
  `maxInstances` is the only hard ceiling you have.

---

## CLI Usage

```bash
# Interactive (recommended)
npx @mksd0398/nitrogen

# With project name
npx @mksd0398/nitrogen my-app

# Skip the deploy steps (scaffold only)
npx @mksd0398/nitrogen my-app --no-deploy

# Auto-install any missing CLI tools without asking
npx @mksd0398/nitrogen my-app --yes

# Non-interactive (CI/CD)
npx @mksd0398/nitrogen my-app \
  --api-key=abc123 \
  --api-secret=secret \
  --project-id=my-firebase-project \
  --create-project \
  --firestore-region=europe-west1 \
  --scopes=read_products,write_products

# Help
npx @mksd0398/nitrogen --help
```

| Flag | |
|---|---|
| `--region=REGION` | Region the functions run in. The wizard asks, offering the region next to the database first. In CI it follows the Firestore location. |
| `--firestore-region=LOC` | Where to create Firestore. The wizard asks, with nothing preselected for you. Cannot be changed later. |
| `--no-deploy` | Scaffold only. |
| `--skip-shopify` | Do not create or link a Shopify app. |
| `--skip-provision` | Do not provision Firebase services. |
| `--distribute` | Open the distribution page for an existing app. |

The region is written to two places that must agree: `APP_REGION` in
`functions/.env`, and every rewrite in `firebase.json`.

---

## Development

### Tests

```bash
cd functions
npm test
```

Runs against an in-memory Firestore with `fetch` stubbed: no emulator, no network,
no credentials. It covers every verifier, the routing, tenant isolation, API keys,
rate limits, and that `index` and `firebase.json` agree. TypeScript projects are
built first and tested as compiled.

### Local with Firebase Emulators

```bash
cd functions
npm run serve
# Functions → http://localhost:5001/<project>/<region>/<function>/<path>
# Firestore → http://localhost:8080
```

The emulator reads the client secret from `functions/.secret.local`.

### Deploy

```bash
firebase deploy --force                       # Everything
firebase deploy --only functions              # All functions
firebase deploy --only functions:products     # One function
firebase deploy --only hosting                # Frontend and rewrites
```

TypeScript projects build automatically before a functions deploy.

**Verify a deploy.** A partly failed deploy uploads Hosting but never releases it:
functions report success while every URL serves the previous version. Compare a
hash of a live asset with your source:

```bash
curl -s https://YOUR-PROJECT.web.app/js/app.js | tr -d '\r' | sha256sum
tr -d '\r' < web/js/app.js | sha256sum
```

### Rotating the client secret

```bash
firebase functions:secrets:set SHOPIFY_API_SECRET
firebase deploy --only functions
```

---

## Extending Your App

### Add an API

See [Writing an API](#writing-an-api).

### Add storefront routes (App Proxy)

Add a route to `functions/src/proxy.ts` and enable `[app_proxy]` in `shopify.app.toml`:

```typescript
"GET /proxy/my-route": async (ctx) => ({ hello: ctx.shop }),
```

### Add webhook handlers

Register the topic in `shopify.app.toml`, then add a case in `functions/src/webhooks.ts`:

```typescript
case "orders/create": {
  const order = body;
  // Your logic. 5 seconds. Queue anything slow.
  break;
}
```

### Open a route to API keys

```typescript
export default endpoint(routes, { apiKey: "read" });
```

Merchants create keys on the **API keys** page. Callers send `X-API-Key: key_live_…`
and act as the shop that created the key. Add scopes to `SCOPES` in `api-keys.ts`.
Keep anything that changes data session-only unless you have decided otherwise.

### Add Firestore collections

```typescript
import { tenantId } from "../config";
import { db } from "../firebase";

await db.collection("myData").doc(tenantId(ctx.app, ctx.shop)).set({ key: "value" });
```

Key tenant data by `tenantId()`, and add the collection to the `shop/redact`
handler in `webhooks.ts` so it is deleted when Shopify asks.

### Add frontend pages

Copy `web/keys.html` and `web/js/pages/keys.js`, and add the link to the
`<ui-nav-menu>` of every page.

### Add Shopify billing

Use the `appSubscriptionCreate` mutation through `graphql(ctx, …)`.

### Add a scheduled function

```typescript
import { onSchedule } from "firebase-functions/v2/scheduler";

export const dailyCleanup = onSchedule("every 24 hours", async () => {
  // ...
});
```

Expired OAuth nonces need no cleanup job: `authNonces.expiresAt` is a Timestamp,
so a [Firestore TTL policy](https://firebase.google.com/docs/firestore/ttl) on that
field purges them.

---

## GDPR Compliance

All three mandatory webhooks are subscribed and verified:

| Webhook | Purpose | Status |
|---------|---------|--------|
| `customers/data_request` | Export customer data | Handler included — add your logic if you store customer data |
| `customers/redact` | Delete customer data | Handler included — add your logic if you store customer data |
| `shop/redact` | Delete all shop data | **Implemented** for `shopSessions` and `appSettings` — add your own collections |

These are **required** for Shopify App Store listing.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Every API call answers 401 | The client secret in Secret Manager does not match the app. `firebase functions:secrets:set SHOPIFY_API_SECRET`, then redeploy functions |
| Webhooks answer 401 | Same cause: the HMAC is verified with that secret |
| A route answers 404 from Hosting | The rewrite's `region` or `serviceId` does not match the function. Run `npm test` in `functions/` |
| A route answers Google's 403 page | The function lost `invoker: "public"` |
| Deploy fails naming a secret | The secret does not exist yet. Create it, then deploy |
| `firebase deploy` exits 1 on a new project | Use `firebase deploy --force` — a bare deploy stalls on the artifact-policy prompt and leaves Hosting unreleased |
| Deploy times out analyzing functions | Set `FUNCTIONS_DISCOVERY_TIMEOUT=120` before deploying |
| The deploy succeeded but the site is unchanged | Hosting was uploaded but not released. Hash-check (see [Deploy](#deploy)) and redeploy |
| 429 from your own API | The per-caller limit. See [Rate Limits](#rate-limits) |
| Firestore create fails with 403 | The Firestore API is not enabled yet: `gcloud services enable firestore.googleapis.com --project=YOUR_ID` |
| `App name cannot contain "Shopify"` | Shopify rejects those names — pick another (the CLI strips it automatically) |
| `shopify app deploy` says "not a member of the organization" | The app was created under a different Shopify account. Run `shopify auth login` |
| "App Engine" on the bill | That is Firestore. See [What It Costs](#what-it-costs) |

---

## Contributing

Contributions welcome! Please open an issue or PR.

```bash
git clone https://github.com/mksd0398/nitrogen.git
cd nitrogen
npm install
npm test            # scaffolds both templates and checks the output
npm run test:e2e    # also installs, builds and tests each scaffold
npm link            # Test locally: nitrogen test-app
```

The JavaScript and TypeScript templates must stay in step: `npm test` fails if
their route tables differ.

---

## Related

- [Shopify App Development](https://shopify.dev/docs/apps) — Official docs
- [Firebase v2 Cloud Functions](https://firebase.google.com/docs/functions) — Backend runtime (gen 2)
- [Shopify App Bridge](https://shopify.dev/docs/api/app-bridge) — Embedded app SDK
- [Shopify Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql) — Store data API
- [Theme App Extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions) — Storefront blocks

---

## License

MIT

---

<p align="center">
  <strong>Build Shopify apps with Firebase — serverless, lightweight, and fully yours.</strong><br/>
  <sub>An alternative to the official Remix template for developers who want simplicity and control.</sub><br/>
  <sub>Nitrogen is an independent community project. Not affiliated with, authorised by, or endorsed by Shopify Inc.<br/>
  Shopify, Hydrogen, Oxygen, Polaris and App Bridge are trademarks of Shopify Inc.</sub>
</p>
