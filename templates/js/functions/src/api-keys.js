// API keys, for callers outside Shopify.
//
// The two built-in doors are both Shopify-gated: the storefront route needs
// an App Proxy signature and the admin route needs a session token minted
// inside the Shopify admin. Neither can be handed to a mobile app, a partner
// system or a script. An API key can.
//
//   - Hashed at rest. The document id IS sha256(key), so the raw value
//     exists only in the response to create(). A database dump yields
//     nothing usable, and nobody can read a key back out.
//   - Scoped. A key opens only functions that ask for its scope:
//       endpoint(routes, { apiKey: "read" })
//   - Owned by one tenant. A key acts as the shop and app that created it.

const crypto = require("crypto");
const { apps, tenantId } = require("./config");
const { db } = require("./firebase");

const COLLECTION = "apiKeys";

// Makes a leaked key recognisable in a log and greppable in a codebase
const PREFIX = "key_live_";

// Add a scope here, then opt a function in to it
const SCOPES = ["read"];

const MAX_KEYS_PER_TENANT = 20;

function hash(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function keysOf(app, shop) {
  return db.collection(COLLECTION).where("tenant", "==", tenantId(app, shop));
}

function summary(id, data) {
  return {
    id,
    name: data.name,
    scope: data.scope,
    hint: data.hint,
    active: data.active !== false,
    createdAt: data.createdAt,
    lastUsedAt: data.lastUsedAt || null,
  };
}

/** Mint a key. The raw value is returned once and never stored. */
async function create(app, shop, { name, scope, createdBy }) {
  const existing = await keysOf(app, shop).limit(MAX_KEYS_PER_TENANT).get();
  if (existing.docs.length >= MAX_KEYS_PER_TENANT) return null;

  const raw = PREFIX + crypto.randomBytes(24).toString("hex");
  const data = {
    tenant: tenantId(app, shop),
    shop,
    app: app.key,
    name,
    scope,
    // Enough to recognise a key in a list without being enough to use it
    hint: raw.slice(0, PREFIX.length + 6),
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
  };
  await db.collection(COLLECTION).doc(hash(raw)).set(data);
  return { ...summary(hash(raw), data), key: raw };
}

/** A tenant's keys. Never returns anything that could authenticate. */
async function list(app, shop) {
  const found = await keysOf(app, shop).limit(MAX_KEYS_PER_TENANT).get();
  return found.docs
    .map((doc) => summary(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Revoke a key. A soft delete: "when was this last used" is the question
 * asked after something has gone wrong. False when it is not this tenant's.
 */
async function revoke(app, shop, id) {
  const ref = db.collection(COLLECTION).doc(id);
  const data = (await ref.get()).data();
  if (!data || data.tenant !== tenantId(app, shop)) return false;
  await ref.set({ active: false, revokedAt: new Date().toISOString() }, { merge: true });
  return true;
}

// Recording every use would cost a write per request
const USAGE_INTERVAL_MS = 60 * 1000;
const lastRecorded = new Map();

/**
 * Verify a presented key. Looked up by hash, so an invalid key costs one
 * read and reveals nothing. A valid key with the wrong scope is refused
 * exactly like an invalid one.
 */
async function verify(presented, scope) {
  if (typeof presented !== "string" || !presented.startsWith(PREFIX)) return null;

  const id = hash(presented);
  const ref = db.collection(COLLECTION).doc(id);
  const data = (await ref.get()).data();
  if (!data || data.active === false || data.scope !== scope) return null;

  const app = apps().find((a) => a.key === data.app);
  if (!app) return null;

  if (Date.now() - (lastRecorded.get(id) || 0) > USAGE_INTERVAL_MS) {
    lastRecorded.set(id, Date.now());
    await ref
      .set({ lastUsedAt: new Date().toISOString() }, { merge: true })
      .catch((err) => console.error("API key usage update failed:", err.message));
  }

  return { id, name: data.name, scope: data.scope, app, shop: data.shop };
}

module.exports = { create, list, revoke, verify, PREFIX, SCOPES };
