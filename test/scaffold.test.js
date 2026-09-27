// Scaffolds both templates and checks what a user would actually receive.
//
//   npm test            fast: files, placeholders, wiring
//   npm run test:e2e    also installs each scaffold, builds it and runs its
//                       own test suite (needs network, takes a few minutes)

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { functionsRegionFor, regionChoices, scaffold } from "../lib/index.js";

const E2E = process.env.NITROGEN_E2E === "1";
const SECRET = "shpss_scaffold_test_secret";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nitrogen-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function files(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === "lib") return [];
    return entry.isDirectory() ? files(full, base) : [path.relative(base, full).replaceAll("\\", "/")];
  });
}

test("functions region follows the Firestore location", () => {
  assert.equal(functionsRegionFor(undefined), "us-central1");
  assert.equal(functionsRegionFor("asia-south1"), "asia-south1");
  assert.equal(functionsRegionFor("nam5"), "us-central1");
  assert.equal(functionsRegionFor("eur3"), "europe-west1");
});

test("the region next to the database is offered first, and only once", () => {
  const known = regionChoices("europe-west3");
  assert.equal(known[0].value, "europe-west3");
  assert.match(known[0].title, /next to your database/);
  assert.equal(known.filter((choice) => choice.value === "europe-west3").length, 1);
  assert.equal(known.filter((choice) => /next to/.test(choice.title)).length, 1);

  const unlisted = regionChoices("me-central1");
  assert.equal(unlisted[0].value, "me-central1");
  assert.equal(unlisted.length, known.length + 1);
});

for (const language of ["javascript", "typescript"]) {
  const ext = language === "javascript" ? "js" : "ts";
  const dir = path.join(tmp, language);

  test(`${language}: scaffold`, async (t) => {
    scaffold(dir, {
      projectName: "demo-app",
      appName: "Demo App",
      language,
      scopes: "read_products",
      apiKey: "test-client-id",
      apiSecret: SECRET,
      projectId: "demo-nitrogen",
      appUrl: "https://demo-nitrogen.web.app",
      region: "asia-south1",
    });
    const all = files(dir);
    const read = (file) => fs.readFileSync(path.join(dir, file), "utf8");

    await t.test("has every source file, and no leftovers from the other language", () => {
      for (const name of ["index", "config", "verify", "http", "auth", "shopify", "webhooks", "proxy", "api-keys", "firebase",
        "api/shop", "api/products", "api/settings", "api/keys", "api/status"]) {
        assert.ok(all.includes(`functions/src/${name}.${ext}`), `missing functions/src/${name}.${ext}`);
      }
      const other = ext === "js" ? ".ts" : ".js";
      assert.deepEqual(all.filter((f) => f.startsWith("functions/src/") && f.endsWith(other)), []);
      for (const file of ["firebase.json", ".gitignore", ".env.example", "shopify.app.toml", "web/keys.html",
        "functions/test/helper.js", "functions/test/security.test.js"]) {
        assert.ok(all.includes(file), `missing ${file}`);
      }
    });

    await t.test("no rendered file still holds a placeholder", () => {
      // Source comments that show users a placeholder to type are exempt
      const rendered = all.filter((f) => !f.startsWith("functions/src/") && !f.startsWith("extensions/"));
      for (const file of rendered) {
        assert.doesNotMatch(read(file), /\{\{[A-Z_]+\}\}/, `${file} has an unrendered placeholder`);
      }
    });

    await t.test("the client secret is only in the emulator's secret file", () => {
      const holders = all.filter((file) => read(file).includes(SECRET));
      assert.deepEqual(holders, ["functions/.secret.local"]);
      assert.match(read(".gitignore"), /^\*\.local$/m);
      assert.ok(JSON.parse(read("firebase.json")).functions[0].ignore.includes("*.local"));
    });

    await t.test("region is stamped into the rewrites and the functions alike", () => {
      const firebaseJson = JSON.parse(read("firebase.json"));
      const regions = new Set(firebaseJson.hosting.rewrites.map((r) => r.run.region));
      assert.deepEqual([...regions], ["asia-south1"]);
      assert.match(read("functions/.env"), /^APP_REGION=asia-south1$/m);
    });

    await t.test("every rewrite names a function exported from index", () => {
      const index = read(`functions/src/index.${ext}`);
      const exported = [...index.matchAll(/^(?:exports\.|export const )(\w+) = onRequest/gm)].map((m) => m[1].toLowerCase());
      const routed = new Set(JSON.parse(read("firebase.json")).hosting.rewrites.map((r) => r.run.serviceId));
      assert.deepEqual([...routed].sort(), exported.sort());
    });

    await t.test("targets the Node.js 24 runtime", () => {
      assert.equal(JSON.parse(read("firebase.json")).functions[0].runtime, "nodejs24");
      assert.equal(JSON.parse(read("functions/package.json")).engines.node, "24");
    });

    await t.test("a TypeScript project builds before it deploys", () => {
      const { predeploy } = JSON.parse(read("firebase.json")).functions[0];
      if (language === "typescript") assert.match(predeploy[0], /run build/);
      else assert.equal(predeploy, undefined);
    });

    await t.test("every page carries the client id and the navigation", () => {
      for (const page of all.filter((f) => /^web\/[^/]+\.html$/.test(f))) {
        assert.match(read(page), /<meta name="shopify-api-key" content="test-client-id">/, page);
        assert.match(read(page), /<a href="\/keys">/, page);
      }
    });

    await t.test("installs, builds and passes its own tests", { skip: !E2E && "set NITROGEN_E2E=1" }, () => {
      const cwd = path.join(dir, "functions");
      execSync("npm install --no-audit --no-fund", { cwd, stdio: "pipe" });
      execSync("npm test", { cwd, stdio: "pipe" });
    });
  });
}

test("both templates expose the same API", () => {
  const routes = (language, ext) =>
    files(path.join(tmp, language, "functions", "src"))
      .flatMap((file) => {
        const source = fs.readFileSync(path.join(tmp, language, "functions", "src", file), "utf8");
        return [...source.matchAll(/^\s+"((?:GET|POST|PUT|PATCH|DELETE) \/[^"]+)":/gm)].map((m) => `${file.replace(ext, "")} ${m[1]}`);
      })
      .sort();
  const js = routes("javascript", ".js");
  assert.ok(js.length >= 9, `expected the full route table, found ${js.length}`);
  assert.deepEqual(routes("typescript", ".ts"), js);
});
