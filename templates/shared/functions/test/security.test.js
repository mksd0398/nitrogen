// What must never regress: every entry point refuses a request it cannot
// verify, and one app can never act as another.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helper");

const { webhookHandler } = h.load("webhooks");
const { authHandler } = h.load("auth");
const verify = h.load("verify");
const proxy = h.load("proxy");

const SESSION = `shopSessions/${h.SHOP}`;
const OTHER_SESSION = `shopSessions/${h.SHOP}__other`;

function webhook(topic, { hmac, body = { id: 1 }, shop = h.SHOP } = {}) {
  const headers = { "x-shopify-topic": topic, "x-shopify-shop-domain": shop };
  if (hmac !== undefined) headers["x-shopify-hmac-sha256"] = hmac;
  return h.call(webhookHandler, { method: "POST", path: "/webhooks", headers, body });
}

// ─── Webhooks ────────────────────────────────────────────────────────────
test("webhook without a signature is refused and deletes nothing", async () => {
  h.store.set(SESSION, { accessToken: "shpat_x" });
  const res = await webhook("app/uninstalled");
  assert.equal(res.statusCode, 401);
  assert.ok(h.store.has(SESSION));
});

test("webhook with a wrong signature is refused", async () => {
  h.store.set(SESSION, { accessToken: "shpat_x" });
  const res = await webhook("app/uninstalled", { hmac: h.webhookHmac({ id: 1 }, "wrong") });
  assert.equal(res.statusCode, 401);
  assert.ok(h.store.has(SESSION));
});

test("webhook without a body is refused", async () => {
  const headers = { "x-shopify-topic": "app/uninstalled", "x-shopify-shop-domain": h.SHOP, "x-shopify-hmac-sha256": "x" };
  const res = await h.call(webhookHandler, { method: "POST", headers });
  assert.equal(res.statusCode, 401);
});

test("signed webhook for an invalid shop domain is refused", async () => {
  const res = await webhook("app/uninstalled", { hmac: h.webhookHmac({ id: 1 }), shop: "evil.com" });
  assert.equal(res.statusCode, 401);
});

test("signed app/uninstalled deletes the session", async () => {
  h.store.set(SESSION, { accessToken: "shpat_x" });
  const res = await webhook("app/uninstalled", { hmac: h.webhookHmac({ id: 1 }) });
  assert.equal(res.statusCode, 200);
  assert.ok(!h.store.has(SESSION));
});

test("one app's webhook cannot delete another app's session", async () => {
  h.store.set(SESSION, { accessToken: "shpat_default" });
  h.store.set(OTHER_SESSION, { accessToken: "shpat_other" });
  const res = await webhook("app/uninstalled", { hmac: h.webhookHmac({ id: 1 }, h.OTHER.secret) });
  assert.equal(res.statusCode, 200);
  assert.ok(h.store.has(SESSION));
  assert.ok(!h.store.has(OTHER_SESSION));
});

test("shop/redact deletes the tenant's data", async () => {
  h.store.set(SESSION, { accessToken: "shpat_x" });
  h.store.set(`appSettings/${h.SHOP}`, { greeting: "hi" });
  await webhook("shop/redact", { hmac: h.webhookHmac({ id: 1 }) });
  assert.ok(!h.store.has(SESSION));
  assert.ok(!h.store.has(`appSettings/${h.SHOP}`));
});

// ─── Session tokens ──────────────────────────────────────────────────────
test("valid session token resolves shop and app", () => {
  const verified = verify.verifySessionToken(h.sessionToken());
  assert.equal(verified.shop, h.SHOP);
  assert.equal(verified.app.key, "default");
  assert.equal(verify.verifySessionToken(h.sessionToken(h.OTHER)).app.key, "other");
});

test("session token expired within the clock tolerance is accepted", () => {
  const exp = Math.floor(Date.now() / 1000) - 5;
  assert.ok(verify.verifySessionToken(h.sessionToken(h.APP, { exp })));
});

test("session token expired beyond the tolerance is refused", () => {
  const exp = Math.floor(Date.now() / 1000) - 30;
  assert.equal(verify.verifySessionToken(h.sessionToken(h.APP, { exp })), null);
});

test("session token cannot claim an app it was not signed by", () => {
  const forged = h.sessionToken(h.APP, {}, h.OTHER.secret);
  assert.equal(verify.verifySessionToken(forged), null);
});

test("session token for an unknown app or a bad issuer is refused", () => {
  assert.equal(verify.verifySessionToken(h.sessionToken({ clientId: "nope", secret: "x" })), null);
  assert.equal(verify.verifySessionToken(h.sessionToken(h.APP, { iss: "https://evil.com/admin", dest: "https://evil.com" })), null);
  assert.equal(verify.verifySessionToken(h.sessionToken(h.APP, { dest: "https://else.myshopify.com" })), null);
});

test("unsigned and garbage tokens are refused", () => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ aud: h.APP.clientId, iss: `https://${h.SHOP}/admin` })).toString("base64url");
  assert.equal(verify.verifySessionToken(`${header}.${payload}.`), null);
  assert.equal(verify.verifySessionToken("garbage"), null);
  assert.equal(verify.verifySessionToken(""), null);
});

// ─── App Proxy ───────────────────────────────────────────────────────────
test("proxy route answers a signed request and refuses the rest", async () => {
  const query = { shop: h.SHOP, path_prefix: "/apps/x", timestamp: "1" };

  const signed = await h.call(proxy, { path: "/proxy/hello", query: h.proxyQuery(query) });
  assert.equal(signed.statusCode, 200);
  assert.match(signed.body.message, /demo\.myshopify\.com/);

  const unsigned = await h.call(proxy, { path: "/proxy/hello", query });
  assert.equal(unsigned.statusCode, 403);

  const tampered = await h.call(proxy, {
    path: "/proxy/hello",
    query: { ...h.proxyQuery(query), shop: "else.myshopify.com" },
  });
  assert.equal(tampered.statusCode, 403);
});

// ─── OAuth ───────────────────────────────────────────────────────────────
async function startOAuth(query = { shop: h.SHOP }) {
  const res = await h.call(authHandler, { path: "/auth", query });
  const location = res.headers.Location ? new URL(res.headers.Location) : null;
  return { res, location, state: location?.searchParams.get("state") };
}

test("OAuth start refuses anything that is not a shop domain", async () => {
  for (const shop of [undefined, "evil.com", "demo.myshopify.com.evil.com", "demo.myshopify.com/x"]) {
    const { res } = await startOAuth({ shop });
    assert.equal(res.statusCode, 400);
  }
});

test("OAuth start redirects to the shop with the app's client id", async () => {
  const { res, location } = await startOAuth();
  assert.equal(res.statusCode, 302);
  assert.equal(location.hostname, h.SHOP);
  assert.equal(location.searchParams.get("client_id"), h.APP.clientId);
  assert.equal(location.searchParams.get("redirect_uri"), "https://demo.web.app/auth/callback");
});

test("OAuth callback stores the token, and the nonce cannot be replayed", async (t) => {
  await h.uninstall();
  h.stubFetch(t, () => ({ json: { access_token: "shpat_new", scope: "read_products" } }));
  const { state } = await startOAuth();
  const query = h.oauthQuery({ shop: h.SHOP, code: "abc", state, timestamp: "1" });

  const first = await h.call(authHandler, { path: "/auth/callback", query });
  assert.equal(first.statusCode, 302);
  assert.equal(h.store.get(SESSION).accessToken, "shpat_new");

  const replay = await h.call(authHandler, { path: "/auth/callback", query });
  assert.equal(replay.statusCode, 403);
});

test("OAuth callback refuses a bad signature, a missing state and an expired nonce", async (t) => {
  const calls = h.stubFetch(t, () => ({ json: { access_token: "shpat_new" } }));
  const { state } = await startOAuth();
  const base = { shop: h.SHOP, code: "abc", timestamp: "1" };
  const callback = (query) => h.call(authHandler, { path: "/auth/callback", query });

  assert.equal((await callback({ ...base, state })).statusCode, 403);
  assert.equal((await callback({ ...base, state, hmac: "0".repeat(64) })).statusCode, 403);
  assert.equal((await callback(h.oauthQuery(base))).statusCode, 403);
  assert.equal((await callback(h.oauthQuery({ ...base, state: "f".repeat(32) }))).statusCode, 403);

  const nonce = h.store.get(`authNonces/${state}`);
  h.store.set(`authNonces/${state}`, { ...nonce, expiresAt: { toMillis: () => Date.now() - 1 } });
  assert.equal((await callback(h.oauthQuery({ ...base, state }))).statusCode, 403);

  assert.equal(calls.length, 0);
});

test("OAuth callback signed by another app cannot use this app's nonce", async (t) => {
  const calls = h.stubFetch(t, () => ({ json: { access_token: "shpat_new" } }));
  const { state } = await startOAuth();
  const query = h.oauthQuery({ shop: h.SHOP, code: "abc", state }, h.OTHER.secret);
  const res = await h.call(authHandler, { path: "/auth/callback", query });
  assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 0);
});
