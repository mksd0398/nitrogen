/**
 * Cloud Function exports — THIS FILE IS YOUR API SURFACE.
 *
 * Every export below is one Cloud Function: its own Cloud Run service, with
 * its own scaling, memory, timeout, logs and deploy. An API exists because
 * it is exported here and has a rewrite in firebase.json.
 *
 *   auth      /auth, /auth/callback     OAuth install + callback
 *   webhooks  /webhooks                 Shopify webhooks (HMAC)
 *   proxy     /proxy/**                 Storefront App Proxy (signature)
 *   shop      /api/shop                 ┐
 *   products  /api/products/**          ├ Admin API, one function per resource
 *   settings  /api/settings             │ (session token)
 *   keys      /api/keys/**              ┘
 *   status    /api/status               session token OR an API key
 *
 * ── Adding an API ─────────────────────────────────────────────────────────
 * Three things must agree. Say the resource is "orders":
 *
 *   1. src/api/orders.js — the routes:
 *        module.exports = endpoint({
 *          "GET /api/orders": async (ctx) => ({ orders: [] }),
 *        });
 *
 *   2. An export here:
 *        exports.orders = onRequest(base, require("./api/orders"));
 *
 *   3. A rewrite in firebase.json, in the same region as the others:
 *        { "source": "/api/orders", "run": { "serviceId": "orders", "region": "..." } },
 *        { "source": "/api/orders/**", "run": { "serviceId": "orders", "region": "..." } }
 *
 * `npm test` checks that 2 and 3 agree, so run it before you deploy.
 *
 * ── Traps ─────────────────────────────────────────────────────────────────
 * - serviceId is the export name LOWERCASED (orderSync -> "ordersync").
 * - Keep `invoker: "public"`: without it an update serves Google's own 403
 *   page, which reads exactly like a CORS bug.
 * - Firebase Hosting cuts a rewritten request at 60 seconds whatever
 *   timeoutSeconds says. Long work has to be chunked by the client.
 * - Shared modules (http, verify, config…) are bundled into every function.
 *   After changing one, deploy them all: firebase deploy --only functions
 *
 * ── Who may call it ───────────────────────────────────────────────────────
 * endpoint(routes)                        the embedded admin (session token)
 * endpoint(routes, { apiKey: "read" })    ...and outside systems with a key
 * endpoint(routes, { auth: "proxy" })     the storefront, via the App Proxy
 * endpoint(routes, { rateLimit: { max: 30, windowSeconds: 60 } })
 *
 * ── A route that needs more ───────────────────────────────────────────────
 * Give a heavy resource its own options and it cannot starve the rest:
 *   exports.imports = onRequest(
 *     { ...base, memory: "1GiB", timeoutSeconds: 60 },
 *     require("./api/imports"),
 *   );
 *
 * Docs: https://firebase.google.com/docs/functions/http-events?gen=2nd
 */

require("./firebase"); // Initialize Firebase Admin SDK — must be first

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { REGION, secrets } = require("./config");
const { authHandler } = require("./auth");
const { webhookHandler } = require("./webhooks");

// maxInstances is a spending cap: a traffic spike or a retry storm cannot
// scale past it. Raise it when real traffic needs more.
setGlobalOptions({ region: REGION, maxInstances: 10 });

const base = {
  secrets: secrets(),
  invoker: "public",
  memory: "256MiB",
  timeoutSeconds: 30,
};

// ─── Shopify plumbing ────────────────────────────────────────────────────
exports.auth = onRequest(base, authHandler);
exports.webhooks = onRequest({ ...base, timeoutSeconds: 10 }, webhookHandler);
exports.proxy = onRequest(base, require("./proxy"));

// ─── Admin API — one function per resource ───────────────────────────────
exports.shop = onRequest(base, require("./api/shop"));
exports.products = onRequest(base, require("./api/products"));
exports.settings = onRequest(base, require("./api/settings"));
exports.keys = onRequest(base, require("./api/keys"));
exports.status = onRequest(base, require("./api/status"));
