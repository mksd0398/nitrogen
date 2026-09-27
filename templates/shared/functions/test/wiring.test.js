// An API exists only when its export and its firebase.json rewrite agree.
// A mismatch does not fail the deploy — Hosting just serves 404 — so it is
// checked here instead.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const h = require("./helper");

const firebaseJson = JSON.parse(
  fs.readFileSync(path.join(h.root, "..", "firebase.json"), "utf8"),
);
const rewrites = firebaseJson.hosting.rewrites;

// functions/.env is gitignored, so a fresh clone has none
const envPath = path.join(h.root, ".env");
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

const functions = Object.entries(h.load("index")).filter(([, fn]) => fn && fn.__endpoint);
const http = functions.filter(([, fn]) => fn.__endpoint.httpsTrigger);

test("every rewrite points at a function that is exported", () => {
  const services = new Set(http.map(([name]) => name.toLowerCase()));
  for (const { source, run } of rewrites) {
    assert.ok(services.has(run.serviceId), `${source} -> "${run.serviceId}" is not exported from index`);
  }
});

test("every HTTP function has a rewrite", () => {
  const routed = new Set(rewrites.map((r) => r.run.serviceId));
  for (const [name] of http) {
    assert.ok(routed.has(name.toLowerCase()), `"${name}" has no rewrite in firebase.json`);
  }
});

test("rewrites use one region, the one the functions deploy to", () => {
  const regions = new Set(rewrites.map((r) => r.run.region));
  assert.equal(regions.size, 1, `rewrites span several regions: ${[...regions]}`);

  const region = env.match(/^APP_REGION=(.+)$/m)?.[1].trim() || "us-central1";
  assert.deepEqual([...regions], [region]);
});

test("every HTTP function is public and mounts the app secrets", () => {
  for (const [name, fn] of http) {
    assert.equal(fn.__endpoint.httpsTrigger.invoker?.[0], "public", `${name} is not invoker: "public"`);
    const mounted = (fn.__endpoint.secretEnvironmentVariables || []).map((s) => s.key);
    assert.ok(mounted.includes("SHOPIFY_API_SECRET"), `${name} does not mount SHOPIFY_API_SECRET`);
  }
});

test("the client secret is not in functions/.env", () => {
  assert.doesNotMatch(env, /SECRET/);
});
