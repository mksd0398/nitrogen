// The Admin API: routing, authentication, tenant isolation and error handling.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helper");

const { endpoint, HttpError } = h.load("http");
const shop = h.load("api/shop");
const products = h.load("api/products");
const settings = h.load("api/settings");

const asDefault = () => h.bearer(h.sessionToken());
const asOther = () => h.bearer(h.sessionToken(h.OTHER));

// ─── endpoint() ──────────────────────────────────────────────────────────
const things = endpoint({
  "GET /api/things/:id": async (ctx) => ({ id: ctx.params.id }),
  "GET /api/things/special": async () => ({ special: true }),
  "POST /api/things": async (ctx) => ({ saved: ctx.body, shop: ctx.shop, app: ctx.app.key }),
  "GET /api/things/:id/teapot": async () => { throw new HttpError(418, "teapot"); },
  "GET /api/things/:id/crash": async () => { throw new Error("secret internal detail"); },
});

test("every route refuses a request without a session token", async () => {
  for (const handler of [things, shop, products, settings]) {
    const res = await h.call(handler, { path: "/api/things/1" });
    assert.equal(res.statusCode, 401);
  }
});

test("a refused session token asks App Bridge to retry with a fresh one", async () => {
  const expired = h.sessionToken(h.APP, { exp: Math.floor(Date.now() / 1000) - 60 });
  for (const headers of [{}, h.bearer(expired)]) {
    const res = await h.call(shop, { path: "/api/shop", headers });
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers["X-Shopify-Retry-Invalid-Session-Request"], "1");
  }
});

test("routes match by method and path, exact paths before parameters", async () => {
  const headers = asDefault();
  assert.deepEqual((await h.call(things, { path: "/api/things/42", headers })).body, { id: "42" });
  assert.deepEqual((await h.call(things, { path: "/api/things/special", headers })).body, { special: true });
  assert.deepEqual((await h.call(things, { path: "/api/things/a%2Fb/", headers })).body, { id: "a/b" });

  const posted = await h.call(things, { method: "POST", path: "/api/things", headers, body: { a: 1 } });
  assert.deepEqual(posted.body, { saved: { a: 1 }, shop: h.SHOP, app: "default" });
});

test("unknown path is 404, wrong method is 405", async () => {
  const headers = asDefault();
  assert.equal((await h.call(things, { path: "/api/nope", headers })).statusCode, 404);
  assert.equal((await h.call(things, { path: "/api/things/%E0%A4%A", headers })).statusCode, 404);

  const res = await h.call(things, { method: "DELETE", path: "/api/things/1", headers });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "GET");
});

test("HttpError keeps its status, anything else is a 500 that leaks nothing", async (t) => {
  t.mock.method(console, "error", () => {});
  const headers = asDefault();

  const teapot = await h.call(things, { path: "/api/things/1/teapot", headers });
  assert.equal(teapot.statusCode, 418);
  assert.deepEqual(teapot.body, { error: "teapot" });

  const crash = await h.call(things, { path: "/api/things/1/crash", headers });
  assert.equal(crash.statusCode, 500);
  assert.deepEqual(crash.body, { error: "Internal server error" });
});

// ─── Settings ────────────────────────────────────────────────────────────
test("settings are saved per tenant and merged with the defaults", async () => {
  const path = "/api/settings";
  const saved = await h.call(settings, { method: "POST", path, headers: asDefault(), body: { greeting: "Hi" } });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.settings.greeting, "Hi");
  assert.equal(saved.body.settings.theme, "auto");

  const other = await h.call(settings, { path, headers: asOther() });
  assert.equal(other.body.settings.greeting, "Welcome to our app!");

  const again = await h.call(settings, { path, headers: asDefault() });
  assert.equal(again.body.settings.greeting, "Hi");
});

test("settings refuse unknown keys, wrong types and oversized values", async () => {
  const post = (body) => h.call(settings, { method: "POST", path: "/api/settings", headers: asDefault(), body });
  assert.equal((await post({ unknown: 1 })).statusCode, 400);
  assert.equal((await post({ notifications: "yes" })).statusCode, 400);
  assert.equal((await post({ customCss: "x".repeat(10001) })).statusCode, 400);
  assert.equal((await post([1])).statusCode, 400);
  assert.equal((await post(undefined)).statusCode, 400);
});

// ─── Admin API calls ─────────────────────────────────────────────────────
test("first call exchanges the ID token, the next reuses the stored token", async (t) => {
  await h.uninstall();
  const calls = h.stubFetch(t, (url) =>
    url.endsWith("/admin/oauth/access_token")
      ? { json: { access_token: "shpat_exchanged", scope: "read_products" } }
      : { json: { data: { shop: { name: "Demo" }, productCount: { count: 3 } } } },
  );

  const first = await h.call(shop, { path: "/api/shop", headers: asDefault() });
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.body.shop, { name: "Demo", productCount: { count: 3 } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.client_id, h.APP.clientId);

  await h.call(shop, { path: "/api/shop", headers: asDefault() });
  assert.equal(calls.length, 3);
});

test("a stale ID token asks App Bridge to retry", async (t) => {
  await h.uninstall();
  h.stubFetch(t, () => ({ status: 400 }));
  const res = await h.call(shop, { path: "/api/shop", headers: asDefault() });
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers["X-Shopify-Retry-Invalid-Session-Request"], "1");
});

test("a revoked access token is dropped and retried", async (t) => {
  h.store.set(`shopSessions/${h.SHOP}`, { accessToken: "shpat_revoked" });
  h.stubFetch(t, () => ({ status: 401 }));
  const res = await h.call(shop, { path: "/api/shop", headers: asDefault() });
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers["X-Shopify-Retry-Invalid-Session-Request"], "1");
  assert.ok(!h.store.has(`shopSessions/${h.SHOP}`));
});

test("a GraphQL error is a 502, not an empty 200", async (t) => {
  t.mock.method(console, "error", () => {});
  h.store.set(`shopSessions/${h.SHOP}`, { accessToken: "shpat_x" });
  h.stubFetch(t, () => ({ json: { data: null, errors: [{ message: "Access denied" }] } }));
  const res = await h.call(products, { path: "/api/products/search", query: { q: "a" }, headers: asDefault() });
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, "Access denied");
});

test("product routes: search, detail by id, invalid id, not found", async (t) => {
  h.store.set(`shopSessions/${h.SHOP}`, { accessToken: "shpat_x" });
  const node = { id: "gid://shopify/Product/1", title: "Hat", variants: { edges: [] } };
  const calls = h.stubFetch(t, (url, init) =>
    init.body.includes("SearchProducts")
      ? { json: { data: { products: { edges: [{ node }] } } } }
      : { json: { data: { product: init.body.includes("/404") ? null : node } } },
  );
  const headers = asDefault();

  const search = await h.call(products, { path: "/api/products/search", query: { q: "hat" }, headers });
  assert.equal(search.body.products[0].title, "Hat");
  assert.equal(calls[0].body.variables.query, "hat");

  const detail = await h.call(products, { path: "/api/products/1", headers });
  assert.equal(detail.body.product.title, "Hat");
  assert.equal(calls[1].body.variables.id, "gid://shopify/Product/1");

  const byGid = await h.call(products, { path: "/api/products/gid%3A%2F%2Fshopify%2FProduct%2F1", headers });
  assert.equal(byGid.statusCode, 200);

  assert.equal((await h.call(products, { path: "/api/products/1%20OR%201", headers })).statusCode, 400);
  assert.equal((await h.call(products, { path: "/api/products/404", headers })).statusCode, 404);
});

// ─── API keys ────────────────────────────────────────────────────────────
const keys = h.load("api/keys");
const status = h.load("api/status");

async function mintKey(headers = asDefault(), body = { name: "Partner" }) {
  const res = await h.call(keys, { method: "POST", path: "/api/keys", headers, body });
  return res.body.key;
}

test("an API key is shown once, stored only as a hash, and opens its scope", async () => {
  const key = await mintKey();
  assert.match(key.key, /^key_live_[a-f0-9]{48}$/);
  assert.ok(!JSON.stringify([...h.store.entries()]).includes(key.key));

  const listed = await h.call(keys, { path: "/api/keys", headers: asDefault() });
  assert.equal(listed.body.keys.find((k) => k.id === key.id).name, "Partner");
  assert.ok(!JSON.stringify(listed.body).includes(key.key));

  const viaHeader = await h.call(status, { path: "/api/status", headers: { "x-api-key": key.key } });
  assert.equal(viaHeader.statusCode, 200);
  assert.equal(viaHeader.body.shop, h.SHOP);
  assert.equal(viaHeader.body.caller, "key:Partner");

  const viaBearer = await h.call(status, { path: "/api/status", headers: h.bearer(key.key) });
  assert.equal(viaBearer.statusCode, 200);
});

test("an API key opens nothing that did not opt in", async () => {
  const key = await mintKey();
  for (const handler of [keys, settings, shop, products]) {
    const res = await h.call(handler, { path: "/api/keys", headers: { "x-api-key": key.key } });
    assert.equal(res.statusCode, 401);
  }
});

test("unknown, wrong-scope and revoked keys are refused", async () => {
  const get = (key) => h.call(status, { path: "/api/status", headers: { "x-api-key": key } });
  assert.equal((await get("key_live_" + "0".repeat(48))).statusCode, 401);
  assert.equal((await get("nonsense")).statusCode, 401);

  const key = await mintKey();
  h.store.set(`apiKeys/${key.id}`, { ...h.store.get(`apiKeys/${key.id}`), scope: "other" });
  assert.equal((await get(key.key)).statusCode, 401);

  const second = await mintKey();
  const revoked = await h.call(keys, { method: "DELETE", path: `/api/keys/${second.id}`, headers: asDefault() });
  assert.equal(revoked.statusCode, 200);
  assert.equal((await get(second.key)).statusCode, 401);
});

test("keys belong to one tenant", async () => {
  const key = await mintKey();
  const others = await h.call(keys, { path: "/api/keys", headers: asOther() });
  assert.ok(!others.body.keys.some((k) => k.id === key.id));

  const revoke = await h.call(keys, { method: "DELETE", path: `/api/keys/${key.id}`, headers: asOther() });
  assert.equal(revoke.statusCode, 404);
  assert.equal((await h.call(status, { path: "/api/status", headers: { "x-api-key": key.key } })).statusCode, 200);
});

test("key creation validates its input", async () => {
  const post = (body) => h.call(keys, { method: "POST", path: "/api/keys", headers: asDefault(), body });
  assert.equal((await post({})).statusCode, 400);
  assert.equal((await post({ name: "x".repeat(101) })).statusCode, 400);
  assert.equal((await post({ name: "ok", scope: "admin" })).statusCode, 400);
});

// ─── Rate limits ─────────────────────────────────────────────────────────
test("a caller over its limit gets 429 with Retry-After, others are unaffected", async () => {
  const limitedRoute = endpoint(
    { "GET /api/limited": async () => ({ ok: true }) },
    { rateLimit: { max: 2, windowSeconds: 60 } },
  );
  const get = (headers) => h.call(limitedRoute, { path: "/api/limited", headers });

  assert.equal((await get(asDefault())).statusCode, 200);
  assert.equal((await get(asDefault())).statusCode, 200);
  const third = await get(asDefault());
  assert.equal(third.statusCode, 429);
  assert.ok(Number(third.headers["Retry-After"]) > 0);

  assert.equal((await get(asOther())).statusCode, 200);
});

test("the limit window resets", () => {
  const { limited } = h.load("http");
  const limit = { max: 1, windowSeconds: 10 };
  const windows = new Map();
  assert.equal(limited(windows, "caller", limit, 1000), 0);
  assert.equal(limited(windows, "caller", limit, 2000), 9);
  assert.equal(limited(windows, "caller", limit, 11000), 0);
});

test("Shopify's own throttling is passed on as 429", async (t) => {
  h.store.set(`shopSessions/${h.SHOP}`, { accessToken: "shpat_x" });
  h.stubFetch(t, () => ({ json: { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] } }));
  const res = await h.call(shop, { path: "/api/shop", headers: asDefault() });
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "2");
});
