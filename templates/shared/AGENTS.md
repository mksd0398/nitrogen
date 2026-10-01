# AGENTS.md

A Shopify embedded app on Firebase, scaffolded by [Nitrogen](https://github.com/mksd0398/nitrogen).
This is for AI coding agents, and anyone else, working in this project.

## Layout

- `functions/src/index.{{EXT}}`: the API surface. Every export is one Cloud Function. Its header comment shows the exact lines for adding an API.
- `functions/src/api/`: one file per API resource, each a route table built with `endpoint()` from `functions/src/http.{{EXT}}`.
- `functions/src/shopify.{{EXT}}`: `graphql()` for the Admin API.
- `functions/src/config.{{EXT}}`: the Shopify apps this backend serves, and `tenantId()`.
- `functions/src/webhooks.{{EXT}}`, `functions/src/proxy.{{EXT}}` (storefront) and `functions/src/auth.{{EXT}}` (install and token exchange).
- `functions/test/`: the test suite. It needs no emulator and no network.
- `web/`: the embedded admin. Plain HTML pages with Polaris web components and App Bridge; no React, no build step.
- `firebase.json`: the Hosting rewrites from URL paths to functions.
- `shopify.app.toml`: the Shopify app's scopes, webhook subscriptions and URLs.

## Commands

| | |
|---|---|
| Test after every change | `cd functions && npm test` |
| Run locally | `cd functions && npm run serve` (Functions and Firestore emulators) |
| Deploy the code | `firebase deploy --force`, from the project root |
| Send `shopify.app.toml` to Shopify | `shopify app deploy`, after changing scopes, webhooks or URLs |

The tests also fail when an export and its rewrite in `firebase.json` disagree.

## Add an API resource

1. Create `functions/src/api/<name>.{{EXT}}`, starting from `functions/src/api/status.{{EXT}}`. A route returns the JSON to send, or throws `HttpError(status, message)`.
2. Export it from `functions/src/index.{{EXT}}`.
3. Add rewrites for `/api/<name>` and `/api/<name>/**` to `firebase.json`. `serviceId` is the export name in lowercase; `region` is the same as the other rewrites.
4. Add tests next to `functions/test/api.test.js`, which shows how to sign a session token and stub Shopify.

`endpoint(routes)` answers the embedded admin. Pass `{ apiKey: "read" }` to also accept API keys, or `{ auth: "proxy" }` for the storefront through the App Proxy.

## Call Shopify

`await graphql(ctx, query, variables)` runs as the calling shop. It turns Shopify's throttling into a 429 and other errors into a 502.

A new scope goes in `[access_scopes]` in `shopify.app.toml`, `SCOPES` in `functions/.env` and `.env.example`. Then run `shopify app deploy`. Merchants approve it the next time they open the app. If a call still says access denied, delete that shop's document in `shopSessions`; the next request exchanges a new token.

Orders and customers are protected customer data. Declare the data and your reasons under API access in the app's Shopify dashboard, or Shopify refuses order and customer webhooks, even on a development store. Orders older than 60 days also need the `read_all_orders` scope.

## Store data

- Key a tenant's data by `tenantId(ctx.app, ctx.shop)`: either one document per tenant with that id, or a `tenant` field on every document and `where("tenant", "==", ...)` on every query.
- Add each new collection to `TENANT_DOCS` or `TENANT_FIELD` in `functions/src/webhooks.{{EXT}}`, so `shop/redact` deletes it.
- Only functions read and write Firestore. `firestore.rules` denies every client; keep it that way.
- Accept only known keys, of the right type and a bounded length, as `functions/src/api/settings.{{EXT}}` does.

## Add a page

1. Copy a page in `web/`, keeping its `<head>`: the `shopify-api-key` meta tag, `app-bridge.js` and `polaris-1.js`.
2. Add a `<s-link>` for it to the `<s-app-nav>` of every page. Each page carries its own copy of the navigation.
3. Put its script in `web/js/pages/` and call the API with `apiFetch("/api/...")` from `web/js/app.js`, which adds the session token.
4. Build the UI from Polaris web components (`<s-page>`, `<s-section>`, `<s-button>`), not Polaris React. `web/polaris.html` shows every component with code, and `web/apis.html` every App Bridge API.

## Add a webhook

1. Subscribe in `shopify.app.toml` with a `[[webhooks.subscriptions]]` block, using the same `uri` as the others.
2. Handle its topic in the `switch` in `functions/src/webhooks.{{EXT}}`. Answer within 5 seconds.
3. Run `firebase deploy --only functions:webhooks`, then `shopify app deploy`.

## Never

- Take the shop or the app from the request. They come from what was verified: `ctx.shop` and `ctx.app`.
- Accept a request whose signature, token or body is missing. Every check in `functions/src/verify.{{EXT}}` fails closed.
- Put the client secret in a committed or deployed file. It lives in Secret Manager: `firebase functions:secrets:set SHOPIFY_API_SECRET --data-file=<file>`. The emulator reads it from `functions/.secret.local`, which git ignores.
- Remove `invoker: "public"` from a function. Hosting would then get Google's 403 page.

## Limits

- Hosting ends a rewritten request at 60 seconds, whatever `timeoutSeconds` says.
- Each shop gets 300 requests a minute and each API key 60, counted per instance (`RATE_LIMITS` in `functions/src/http.{{EXT}}`).
- `maxInstances: 10` in `functions/src/index.{{EXT}}` caps spending. Raise it when real traffic needs more.
