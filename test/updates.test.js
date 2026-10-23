// The weekly update check: what counts as behind, and which findings may be
// applied without a person.
//
// The routine that acts on these findings may not edit tests, so nothing here
// names a version the repository pins today. Expectations are worked out
// from whatever it pins when the test runs.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, rangeStatus, report, runtimes, shopifyVersions, SOURCES, TESTED_TOOLS, workflowActions } from "../tools/check-updates.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const json = (file) => JSON.parse(read(file));

test("a caret range is current, covered, or left behind by a new major", () => {
  assert.equal(rangeStatus("^7.4.0", "7.4.0"), "current");
  assert.equal(rangeStatus("^7.4.0", "7.5.2"), "covered");
  assert.equal(rangeStatus("^7.4.0", "8.0.0"), "major");
  // Below 1.0 a caret pins the minor
  assert.equal(rangeStatus("^0.3.1", "0.3.9"), "covered");
  assert.equal(rangeStatus("^0.3.1", "0.4.0"), "major");
  for (const other of ["~1.2.0", "1.2.3", ">=1", "*", "latest"]) {
    assert.equal(rangeStatus(other, "9.9.9"), "unknown", other);
  }
});

test("the Shopify version is the newest one the calendar says has shipped", () => {
  const listed = "July26 = '2026-07',\n  October26 = '2026-10',\n  January27 = '2027-01',";
  // Shopify lists scheduled versions next to shipped ones: the date decides
  assert.deepEqual(shopifyVersions(new Date("2026-09-30T23:00:00Z"), listed), { due: "2026-07", latest: "2026-07" });
  assert.deepEqual(shopifyVersions(new Date("2026-10-01T00:00:00Z"), listed), { due: "2026-10", latest: "2026-10" });
  assert.deepEqual(shopifyVersions(new Date("2027-01-15T00:00:00Z"), listed), { due: "2027-01", latest: "2027-01" });
  // Due by the calendar, but Shopify's own library does not have it yet
  assert.deepEqual(shopifyVersions(new Date("2027-04-02T00:00:00Z"), listed), { due: "2027-04", latest: "2027-01" });
});

test("Firebase's runtime table is read for status and deprecation date", () => {
  const table = `
  nodejs22: {
    friendly: "Node.js 22",
    status: "GA",
    deprecationDate: "2027-04-30",
    decommissionDate: "2028-10-31",
  },
  nodejs24: { friendly: "Node.js 24", status: "GA", deprecationDate: "2028-04-30" },
  nodejs26: { friendly: "Node.js 26", status: "beta", deprecationDate: "2030-04-30" },
  python313: { friendly: "Python 3.13", status: "GA", deprecationDate: "2029-10-10" },`;
  assert.deepEqual(runtimes(table), [
    { node: 22, status: "GA", deprecationDate: "2027-04-30" },
    { node: 24, status: "GA", deprecationDate: "2028-04-30" },
    { node: 26, status: "beta", deprecationDate: "2030-04-30" },
  ]);
});

test("the actions a workflow uses are read with their major", () => {
  const workflow = "steps:\n  - uses: actions/checkout@v7\n  - uses: actions/setup-node@v7.1.0\n    with:\n      node-version: 24\n  - run: npm ci\n";
  assert.deepEqual(workflowActions(workflow), [
    { action: "actions/checkout", major: 7, line: 2 },
    { action: "actions/setup-node", major: 7, line: 3 },
  ]);
});

test("an action pinned to a commit is read with the version its comment names", () => {
  const workflow = "steps:\n  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n";
  assert.deepEqual(workflowActions(workflow), [{ action: "actions/checkout", major: 7, line: 2 }]);
});

// ─── The whole check, against this repository with every source faked ────
const pinnedApi = read("templates/ts/functions/src/shopify.ts").match(/API_VERSION = "(\d{4}-\d{2})"/)[1];
const pinnedNode = Number(json("templates/shared/firebase.json").functions[0].runtime.replace("nodejs", ""));

function nextQuarter(version) {
  const [year, month] = version.split("-").map(Number);
  return month === 10 ? `${year + 1}-01` : `${year}-${String(month + 3).padStart(2, "0")}`;
}

const floors = {};
for (const file of ["package.json", "templates/js/functions/package.json", "templates/ts/functions/package.json"]) {
  const pkg = json(file);
  for (const [name, range] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    floors[name] = range.replace(/^\^/, "");
  }
}

// A world in which nothing is behind. `changes` overrides one fact at a time.
function world(changes = {}) {
  const facts = {
    today: new Date(`${pinnedApi}-20T00:00:00Z`),
    npm: withNpm({}),
    shopify: `'${pinnedApi}', '${nextQuarter(pinnedApi)}'`,
    runtimes: `nodejs${pinnedNode}: { status: "GA", deprecationDate: "2099-01-01" },`,
    actionMajor: null, // null: whatever each workflow already uses
    ...changes,
  };
  const used = Object.fromEntries(
    fs.readdirSync(path.join(ROOT, ".github", "workflows")).flatMap((file) =>
      workflowActions(read(`.github/workflows/${file}`)).map(({ action, major }) => [action, major]),
    ),
  );
  const fetchText = async (url) => {
    if (url === SOURCES.shopifyVersions) return facts.shopify;
    if (url === SOURCES.firebaseRuntimes) return facts.runtimes;
    const npm = url.match(/^https:\/\/registry\.npmjs\.org\/(.+)\/latest$/);
    if (npm) {
      const name = decodeURIComponent(npm[1]);
      if (!(name in facts.npm)) throw new Error(`unexpected package ${name}`);
      return JSON.stringify({ version: facts.npm[name] });
    }
    const action = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/HEAD\/package\.json$/);
    if (action) return JSON.stringify({ version: `${facts.actionMajor ?? used[action[1]]}.0.0` });
    throw new Error(`unexpected request ${url}`);
  };
  return { root: ROOT, today: facts.today, fetchText };
}

const kinds = (findings) => findings.map((finding) => finding.kind);

test("with every source level with the repository, there is nothing to update", async () => {
  const findings = await check(world());
  assert.deepEqual(findings, []);
  assert.match(report(findings), /Nothing to update/);
});

test("a newer Shopify API version is an auto finding that lists every line to change", async () => {
  const next = nextQuarter(pinnedApi);
  const findings = await check(world({ today: new Date(`${next}-09T00:00:00Z`) }));
  assert.deepEqual(kinds(findings), ["auto"]);
  const [finding] = findings;
  assert.match(finding.what, new RegExp(`${pinnedApi}.*${next}`));
  const files = new Set(finding.where.map((place) => place.file));
  for (const file of [
    "templates/js/functions/src/shopify.js",
    "templates/ts/functions/src/shopify.ts",
    "templates/shopify.app.toml",
    "templates/shared/extensions/theme-block/shopify.extension.toml",
    "README.md",
    "lib/index.js",
  ]) {
    assert.ok(files.has(file), `${file} is not listed`);
  }
  // The README badge spells the version with a doubled dash
  const badge = finding.where.find((place) => place.file === "README.md" && read("README.md").split("\n")[place.line - 1].includes("img.shields.io"));
  assert.ok(badge, "the README badge line is not listed");
  assert.ok(!files.has("CHANGELOG.md"), "history is not rewritten");
  assert.match(report(findings), /^auto\b/m);
});

test("a version due by the calendar that Shopify has not listed is unknown, not an update", async () => {
  const next = nextQuarter(pinnedApi);
  const findings = await check(world({ today: new Date(`${next}-09T00:00:00Z`), shopify: `'${pinnedApi}'` }));
  assert.deepEqual(kinds(findings), ["unknown"]);
});

test("a new major of a dependency is manual; a newer version in range is optional", async () => {
  const [major, minor] = floors["firebase-functions"].split(".").map(Number);
  const breaking = await check(world({ npm: withNpm({ "firebase-functions": `${major + 1}.0.0` }) }));
  assert.deepEqual(kinds(breaking), ["manual"]);
  assert.deepEqual(
    breaking[0].where.map((place) => place.file).sort(),
    ["templates/js/functions/package.json", "templates/ts/functions/package.json"],
  );

  const inRange = await check(world({ npm: withNpm({ "firebase-functions": `${major}.${minor + 1}.0` }) }));
  assert.deepEqual(kinds(inRange), ["optional"]);
  // On its own an optional finding is not a reason to release
  assert.match(report(inRange), /Nothing to update/);
});

function withNpm(overrides) {
  return { ...floors, "firebase-tools": `${TESTED_TOOLS["firebase-tools"]}.1.0`, "@shopify/cli": `${TESTED_TOOLS["@shopify/cli"]}.2.0`, ...overrides };
}

test("a newer runtime, a retiring runtime, a newer action and a newer tool major are all manual", async () => {
  const newer = await check(world({ runtimes: `nodejs${pinnedNode}: { status: "GA", deprecationDate: "2099-01-01" },\n nodejs${pinnedNode + 2}: { status: "GA", deprecationDate: "2099-01-01" },` }));
  assert.deepEqual(kinds(newer), ["manual"]);
  assert.ok(newer[0].where.some((place) => place.file === "templates/shared/firebase.json"));

  // A runtime that is not GA yet is not an update
  const beta = await check(world({ runtimes: `nodejs${pinnedNode}: { status: "GA", deprecationDate: "2099-01-01" },\n nodejs${pinnedNode + 2}: { status: "beta", deprecationDate: "2099-01-01" },` }));
  assert.deepEqual(beta, []);

  const facts = world();
  const soon = new Date(facts.today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const retiring = await check(world({ runtimes: `nodejs${pinnedNode}: { status: "GA", deprecationDate: "${soon}" },` }));
  assert.deepEqual(kinds(retiring), ["manual"]);

  const action = await check(world({ actionMajor: 99 }));
  assert.ok(action.length >= 1);
  assert.ok(action.every((finding) => finding.kind === "manual" && finding.where.every((place) => place.file.startsWith(".github/workflows/"))));

  const tool = await check(world({ npm: withNpm({ "firebase-tools": `${TESTED_TOOLS["firebase-tools"] + 1}.0.0` }) }));
  assert.deepEqual(kinds(tool), ["manual"]);
  assert.deepEqual(tool[0].where, []);
});

test("a source that cannot be reached is unknown, never up to date", async () => {
  const facts = world();
  const findings = await check({
    ...facts,
    fetchText: async (url) => {
      if (url === SOURCES.firebaseRuntimes) throw new Error("HTTP 403");
      return facts.fetchText(url);
    },
  });
  assert.deepEqual(kinds(findings), ["unknown"]);
  assert.match(findings[0].detail, /HTTP 403/);
  assert.doesNotMatch(report(findings), /Nothing to update/);
});
