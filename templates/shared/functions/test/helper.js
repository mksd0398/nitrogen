// Test harness: loads the functions code with an in-memory Firestore and a
// stubbed fetch, so `npm test` needs no emulator, network or credentials.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// TypeScript projects are tested as compiled (npm test builds first)
const root = path.join(__dirname, "..");
const codeDir = path.join(root, fs.existsSync(path.join(root, "tsconfig.json")) ? "lib" : "src");

const APP = { clientId: "test-client-id", secret: "test-secret" };
const OTHER = { clientId: "other-client-id", secret: "other-secret" };
const SHOP = "demo.myshopify.com";

process.env.SHOPIFY_API_KEY = APP.clientId;
process.env.SHOPIFY_API_SECRET = APP.secret;
process.env.APP_URL = "https://demo.web.app";
process.env.OTHER_API_KEY = OTHER.clientId;
process.env.OTHER_API_SECRET = OTHER.secret;
process.env.OTHER_APP_URL = "https://other.web.app";

// ─── In-memory Firestore ─────────────────────────────────────────────────
const store = new Map();

function doc(collection, id) {
  const key = `${collection}/${id}`;
  const ref = {
    // A snapshot: what the document held when it was read, as in Firestore
    get: async () => {
      const exists = store.has(key);
      const data = exists ? { ...store.get(key) } : undefined;
      return { exists, data: () => data, ref };
    },
    set: async (data, options) => {
      store.set(key, options?.merge ? { ...store.get(key), ...data } : { ...data });
    },
    delete: async () => void store.delete(key),
  };
  return ref;
}

function query(collection, filters, max = Infinity) {
  return {
    where: (field, op, value) => query(collection, [...filters, [field, value]], max),
    limit: (n) => query(collection, filters, n),
    get: async () => ({
      docs: [...store.entries()]
        .filter(([key]) => key.startsWith(`${collection}/`))
        .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
        .slice(0, max)
        .map(([key, data]) => ({ id: key.slice(collection.length + 1), data: () => data })),
    }),
  };
}

const db = {
  collection: (name) => ({ doc: (id) => doc(name, id), ...query(name, []) }),
};

const firebasePath = require.resolve(path.join(codeDir, "firebase"));
require.cache[firebasePath] = {
  id: firebasePath,
  filename: firebasePath,
  loaded: true,
  exports: { db },
};

function load(name) {
  const loaded = require(path.join(codeDir, name));
  return loaded.default || loaded;
}

// A second Shopify app on the same backend, for the tenancy tests
const { defineSecret } = require("firebase-functions/params");
const config = load("config");
if (!config.APPS.some((app) => app.key === "other")) {
  config.APPS.push({
    key: "other",
    clientIdEnv: "OTHER_API_KEY",
    appUrlEnv: "OTHER_APP_URL",
    secret: defineSecret("OTHER_API_SECRET"),
  });
}

/** Remove a shop's session the way the app does, instance cache included. */
function uninstall(shop = SHOP) {
  return load("auth").deleteSession(config.apps()[0], shop);
}

// ─── Requests and responses ──────────────────────────────────────────────
function request({ method = "GET", path: urlPath = "/", query = {}, headers = {}, body } = {}) {
  const rawBody = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  return { method, path: urlPath, query, headers, body, rawBody };
}

function response() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    headersSent: false,
    status(code) { res.statusCode = code; return res; },
    set(headers) { Object.assign(res.headers, headers); return res; },
    setHeader(name, value) { res.headers[name] = value; return res; },
    json(value) { res.body = value; res.headersSent = true; return res; },
    send(value) { res.body = value; res.headersSent = true; return res; },
    redirect(url) { res.statusCode = 302; res.headers.Location = url; res.headersSent = true; return res; },
  };
  return res;
}

async function call(handler, options) {
  const res = response();
  await handler(request(options), res);
  return res;
}

// ─── Signing, the way Shopify does it ────────────────────────────────────
const jwt = require("jsonwebtoken");

function sessionToken(app = APP, overrides = {}, signWith = app.secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://${SHOP}/admin`,
    dest: `https://${SHOP}`,
    aud: app.clientId,
    sub: "1",
    exp: now + 60,
    nbf: now - 5,
    iat: now - 5,
    ...overrides,
  };
  return jwt.sign(payload, signWith, { algorithm: "HS256" });
}

function bearer(token) {
  return { authorization: `Bearer ${token}` };
}

function webhookHmac(body, secret = APP.secret) {
  return crypto.createHmac("sha256", secret).update(Buffer.from(JSON.stringify(body))).digest("base64");
}

function signQuery(query, secret, separator) {
  const message = Object.keys(query).sort().map((k) => `${k}=${query[k]}`).join(separator);
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

const proxyQuery = (query, secret = APP.secret) => ({ ...query, signature: signQuery(query, secret, "") });
const oauthQuery = (query, secret = APP.secret) => ({ ...query, hmac: signQuery(query, secret, "&") });

// ─── fetch ───────────────────────────────────────────────────────────────
/** Replace global fetch for one test. Returns the calls made. */
function stubFetch(t, reply) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : undefined });
    const { status = 200, json = {} } = await reply(String(url), init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
      text: async () => JSON.stringify(json),
    };
  };
  t.after(() => { global.fetch = original; });
  return calls;
}

module.exports = {
  APP, OTHER, SHOP, root, codeDir, store, load, call, uninstall,
  sessionToken, bearer, webhookHmac, proxyQuery, oauthQuery, stubFetch,
};
