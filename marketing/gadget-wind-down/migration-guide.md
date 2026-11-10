---
title: "Gadget is shutting down. Here's how to move your Shopify app to Firebase"
description: "Gadget's platform goes offline on March 31, 2027. A practical, concept-by-concept guide to rebuilding a Gadget Shopify app on Firebase Cloud Functions and Firestore with Nitrogen, and what it costs."
tags: shopify, firebase, gadget, serverless
canonical_url: https://github.com/mksd0398/nitrogen/blob/master/marketing/gadget-wind-down/migration-guide.md
---

# Gadget is shutting down. Here's how to move your Shopify app to Firebase

Gadget [announced it is winding down](https://gadget.dev/blog/gadget-wind-down).
If you build Shopify apps on it, these are the dates that matter:

| | |
|---|---|
| **Now** | No new Gadget applications can be started. |
| **End of November 2026** | Last chance for a *first-time* deploy to production. |
| **Until March 31, 2027** | Existing apps keep running as normal. |
| **After March 31, 2027** | The platform is gone. |
| **"Next few weeks"** | Gadget says official migration guides and tools are coming. |

You have about four and a half months of runway. That is enough time to move
calmly, and not enough to leave it until March. This guide is for the moment you
decide where to move to.

> **Disclosure:** I maintain [Nitrogen](https://github.com/mksd0398/nitrogen), an
> open-source (MIT) CLI that scaffolds Shopify apps on Firebase. This guide
> recommends it, and it also says where it falls short of Gadget.

---

## What you are actually replacing

Gadget bundled a lot into one product. Before picking a destination, list which of
these your app really uses, because each one needs its own answer:

1. **Hosting and compute** for your backend code
2. **A database** for your own models
3. **Shopify auth**: OAuth, session tokens, the embedded-app handshake
4. **Webhook intake and verification**, including the mandatory GDPR webhooks
5. **Shopify data sync**: Gadget's copies of products, orders and so on
6. **Background work**: scheduled and queued actions
7. **An admin frontend** embedded in Shopify
8. **Secrets and environment config**

Most apps lean hard on 1–4 and 7, use some of 6, and use 5 for a handful of models.
That matters, because 1–4 and 7 are the parts you can get back on day one.

## The options, honestly

| | Shopify's template (React Router) | Cloudflare (e.g. [shopiflare](https://github.com/safwanadnan/shopiflare)) | **Firebase with Nitrogen** |
|---|---|---|---|
| Compute | A Node server you host (Fly, Render, Heroku…) | Workers | Cloud Functions gen 2, one per API resource |
| Database | Prisma + Postgres/SQLite | D1 (SQLite) + Drizzle | Firestore |
| Idle cost | An always-on server | ~Zero | Zero, everything scales to zero |
| Frontend | React + Polaris | React Router + Polaris | Polaris web components, no build step |
| Setup | `shopify app init`, then hosting is yours | Fork, create Workers/D1 resources, wire secrets | One command creates the Shopify app, the Firebase project, the secret, deploys, and gives you an install link |
| Lock-in after Gadget | Low | Medium (Workers APIs) | Medium (Firebase APIs), but all the code is in your repo |

All three are reasonable. Pick Shopify's template if you want the most-trodden path,
Cloudflare if you are already on Workers, and Firebase if you want something closest
to Gadget's "I don't manage a server and I don't pay when nobody is using it" feel,
with the least setup.

The rest of this guide is the Firebase route.

## Step 1: get a running app (10 minutes)

```bash
npx @mksd0398/nitrogen my-app
```

The CLI checks your tools, signs you in to Shopify, creates the Shopify app,
creates and provisions a Firebase project, stores the client secret in Secret
Manager, deploys, and prints an install link. You never paste the client secret
anywhere; it is read from the Shopify CLI.

You need a Shopify Partner account, a Google account, and the Firebase **Blaze**
plan (pay as you go, with a free tier, more on that below).

What you have at the end is the equivalent of a fresh Gadget app with the Shopify
connection set up:

- OAuth and token exchange, sessions stored in Firestore
- Session-token verification on every admin API call
- HMAC-verified webhooks, with `app/uninstalled`, `customers/*` and `shop/redact` handled
- An embedded admin (dashboard, product search, a settings form saved per shop, API keys)
- A storefront App Proxy route and a theme app extension
- A test suite (`npm test`) that runs with no emulator and no network

Install it on a dev store from the Partner Dashboard and you have a working baseline
to port your logic into.

**Keep your existing Shopify app.** The wizard can create a new Shopify app, which is
right for a test run. For the real migration, build against the app your merchants
already installed, so nobody has to reinstall. Pass its client ID and secret:

```bash
SHOPIFY_API_SECRET="$(cat secret.txt)" npx @mksd0398/nitrogen my-app \
  --api-key=YOUR_EXISTING_CLIENT_ID --project-id=my-firebase-project --no-deploy
```

`--no-deploy` scaffolds without touching the live app; you deploy at cutover.

## Step 2: map Gadget concepts to files

| In Gadget | In a Nitrogen app |
|---|---|
| A model you defined | A Firestore collection. Key per-shop documents with `tenantId(ctx.app, ctx.shop)`. |
| A model action / global action | A route in `functions/src/api/<resource>.ts`: return JSON or throw `HttpError`. |
| The auto-generated API your frontend calls | `apiFetch("/api/<resource>")` in `web/js/app.js`, which attaches the session token and retries once on 401. |
| Access control / roles | `endpoint(routes)` for admin sessions, `{ apiKey: "read" }` for outside callers, `{ auth: "proxy" }` for the storefront. |
| `connections.shopify.current` | `graphql(ctx, query, variables)` in `functions/src/shopify.ts`, already scoped to the verified shop. |
| Shopify webhook triggers | A `case "orders/create":` in `functions/src/webhooks.ts`, plus the topic in `shopify.app.toml`. |
| Scheduled actions | `onSchedule` from `firebase-functions/v2/scheduler`. |
| Background / enqueued actions | `onTaskDispatched` (Cloud Tasks), with retries and rate limits per queue. |
| Environment variables / secrets | `functions/.env` for config, Secret Manager (`firebase functions:secrets:set`) for secrets. |
| The Gadget frontend (React) | `web/*.html` with Polaris web components and App Bridge. Or keep your React build and serve it from Firebase Hosting. |
| Per-shop tenancy | Built in. The shop always comes from a verified credential, never from the request. |

A Gadget action like "save this shop's settings" becomes:

```typescript
// functions/src/api/settings.ts
import { endpoint, HttpError } from "../http";
import { db } from "../firebase";
import { tenantId } from "../config";

export default endpoint({
  "GET /api/settings": async (ctx) => {
    const doc = await db.collection("appSettings").doc(tenantId(ctx.app, ctx.shop)).get();
    return { settings: doc.data() ?? {} };
  },
  "POST /api/settings": async (ctx) => {
    if (typeof ctx.body?.greeting !== "string") throw new HttpError(400, "greeting is required");
    await db.collection("appSettings").doc(tenantId(ctx.app, ctx.shop))
      .set({ greeting: ctx.body.greeting }, { merge: true });
    return { ok: true };
  },
});
```

Then one export in `functions/src/index.ts` and two rewrites in `firebase.json`.
`npm test` fails if those three disagree, so you can't forget one.

## Step 3: replace Shopify data sync deliberately

This is the one piece that does not come for free, and it is where most migration
effort goes. Gadget kept copies of Shopify records for you. Before rebuilding that,
check whether you need it at all:

- **If you only read Shopify data in response to a merchant action**, call the Admin
  GraphQL API directly. No copy, nothing to keep fresh. This covers more apps than
  you'd expect.
- **If you need a few fields locally** (to query or join on), subscribe to the
  relevant webhooks and write just those fields to Firestore.
- **If you need a full mirror**, run a one-off backfill with Shopify's Bulk
  Operations API from a queued function, then keep it current with webhooks.

Keep webhook handlers fast: Shopify waits 5 seconds. Anything slow goes on a Cloud
Tasks queue.

## Step 4: move the data

Wait for Gadget's export tooling, which they say is coming in the next few weeks,
then write a one-off script that reads the export and writes Firestore documents
with the Admin SDK in batches of 500. Two things to get right:

- Key per-shop documents the same way your new routes read them (`tenantId(...)`).
- Add every new collection to the `shop/redact` handler in `webhooks.ts`, so GDPR
  deletion keeps working.

Re-run the script just before cutover to pick up recent writes.

## Step 5: cut over

1. Point the Shopify app's URLs at Firebase (`shopify app deploy` does this from
   `shopify.app.toml`), or create a new app version.
2. Re-register webhooks to the new endpoint (also from `shopify.app.toml`).
3. Because it is the same Shopify app, existing installs get a fresh access token
   through token exchange on their first request. Merchants don't reinstall.
4. Keep Gadget running read-only for a week as a fallback. You have until March 31.

## What it costs

Firebase's Blaze plan has a free tier, and an idle app costs nothing. The README
works through the numbers: with every store making 10 Admin API calls a day,
**about 1,200 daily active stores fit in the free tier**. Past that, roughly:

| Daily active stores | Per month |
|---|---|
| 1,200 | $0 |
| 5,000 | ~$14 |
| 10,000 | ~$32 |
| 50,000 | ~$187 |

Functions CPU is the bill, not Firestore. What actually produces a large invoice is
full-collection work (exports, backfills, sync jobs), not traffic. Set a budget
alert on day one: Firebase alerts, it doesn't cap. Try your own numbers in the
[cost calculator](https://mksd0398.github.io/nitrogen/#calculator).

## Where Nitrogen is weaker than Gadget

- **No managed Shopify data sync.** You build what you need (step 3).
- **No generated client or schema editor.** Routes are plain TypeScript functions;
  you write the fetch calls.
- **No hosted IDE.** It's your editor and your repo.
- **Firestore is not relational.** If your models lean on joins and ad-hoc
  queries, plan your document shapes, or keep Postgres (Cloud SQL) for that part.

In return, every line your app runs is in your repository, you can read it, and no
platform decision can switch it off again.

## Doing it with an AI agent

Nitrogen ships an agent skill that teaches Claude Code, Cursor, Codex, Copilot and
Gemini CLI how a Nitrogen app fits together, including its security and tenancy
rules:

```bash
npx skills add mksd0398/nitrogen
```

Point the agent at your Gadget app's action files and ask it to port them one
resource at a time into `functions/src/api/`. Run `npm test` after each one.

---

**Links:** [GitHub](https://github.com/mksd0398/nitrogen) ·
[npm](https://www.npmjs.com/package/@mksd0398/nitrogen) ·
[Website and cost calculator](https://mksd0398.github.io/nitrogen/)

If you get stuck migrating, open an issue on the repository with what your Gadget
app does. Those questions shape what goes into the next release.
