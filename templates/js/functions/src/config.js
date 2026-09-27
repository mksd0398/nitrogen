// App registry, secrets and region — the one place configuration is read.
//
// Plain values (client id, URL, scopes, region) live in functions/.env.
// Client secrets live in Secret Manager and are mounted per function with
// `secrets: SECRETS` (see index.js). They are NOT in .env: everything in
// functions/ is baked into the deployed container, .gitignore has no say.
// Docs: https://firebase.google.com/docs/functions/config-env

const { defineSecret, defineString } = require("firebase-functions/params");

// Resolved at deploy time, so it must be a param rather than process.env.
// It has to equal the "region" of every rewrite in firebase.json — a mismatch
// does not fail the deploy, Hosting just serves 404.
const REGION = defineString("APP_REGION", { default: "us-central1" });

// ─── Shopify apps served by this backend ─────────────────────────────────
// Tenancy has two axes. The SHOP axis is built in: one app, many stores,
// state keyed by shop domain. The APP axis is this list: several Shopify
// apps (one per brand, say) on the same functions and the same Firestore.
//
// To add an app: add an entry, put its client id and URL in functions/.env,
// and create its secret BEFORE deploying (a missing secret fails the deploy):
//   firebase functions:secrets:set SHOPIFY_API_SECRET_BRAND_B
//
//   { key: "brand-b", clientIdEnv: "BRAND_B_API_KEY", appUrlEnv: "BRAND_B_APP_URL",
//     secret: defineSecret("SHOPIFY_API_SECRET_BRAND_B") },
//
// The first entry is the default app. Never reorder or rename keys once
// shops are installed: the key is part of every tenant's document id.
const APPS = [
  {
    key: "default",
    clientIdEnv: "SHOPIFY_API_KEY",
    appUrlEnv: "APP_URL",
    secret: defineSecret("SHOPIFY_API_SECRET"),
  },
];

/** Every app that is fully configured. A half-configured app verifies nothing. */
function apps() {
  return APPS.map((app) => ({
    key: app.key,
    clientId: process.env[app.clientIdEnv] || "",
    appUrl: process.env[app.appUrlEnv] || "",
    secret: app.secret.value(),
  })).filter((app) => app.clientId && app.secret);
}

/** Secrets every function mounts. Spread into onRequest options. */
function secrets() {
  return APPS.map((app) => app.secret);
}

/**
 * Document id for one tenant: a shop under one app. The default app keeps the
 * bare shop domain, so data written before a second app existed needs no
 * migration.
 */
function tenantId(app, shop) {
  return app.key === APPS[0].key ? shop : `${shop}__${app.key}`;
}

function getConfig() {
  return { scopes: process.env.SCOPES || "read_products" };
}

module.exports = { APPS, REGION, apps, secrets, tenantId, getConfig };
