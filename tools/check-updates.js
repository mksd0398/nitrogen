// Compares what this repository pins with what is current:
//
//   npm run check:updates
//
//   - npm dependency ranges, in the CLI and both templates
//   - the Shopify API version
//   - the Cloud Functions Node runtime
//   - the GitHub Actions the workflows use
//   - new majors of the Firebase and Shopify CLIs
//
// Each finding names the lines to change and is one of:
//
//   auto      safe to apply once the tests pass
//   optional  a range that could be raised; not a reason to release on its own
//   manual    needs a person: tests cannot prove it works on a real project
//   unknown   a source could not be read, so nothing is known either way
//
// The weekly routine runs this first (see RELEASING.md). Exit code: 0 when
// there is nothing to do, 1 when there is, 2 when something is unknown.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// The majors of the tools the CLI drives that it has been run against. A newer
// major may have renamed a command or a flag: try the CLI with it on a real
// project, then raise the number here.
export const TESTED_TOOLS = { "firebase-tools": 15, "@shopify/cli": 4 };

// Everything is read from npm's registry or raw.githubusercontent.com, the
// two hosts a restricted network (a cloud agent's, say) can still reach.
export const SOURCES = {
  shopifyVersions: "https://raw.githubusercontent.com/Shopify/shopify-app-js/HEAD/packages/apps/shopify-api/lib/types.ts",
  firebaseRuntimes: "https://raw.githubusercontent.com/firebase/firebase-tools/HEAD/src/deploy/functions/runtimes/supported/types.ts",
};

const PACKAGE_FILES = ["package.json", "templates/js/functions/package.json", "templates/ts/functions/package.json"];
const API_VERSION_FILE = "templates/ts/functions/src/shopify.ts";
const FIREBASE_JSON = "templates/shared/firebase.json";
// Where the API version is written down. CHANGELOG.md is history, not a pin.
const VERSION_MENTIONS = ["README.md", "lib", "templates", "docs", "skills"];
const TEXT_FILE = /\.(md|js|ts|json|toml|html|txt|liquid|yml)$/;
const RETIRING_WITHIN_DAYS = 180;

// ─── What counts as behind ───────────────────────────────────────────────
const numbers = (version) => version.split(".").map(Number);

function newer(a, b) {
  const [x, y] = [numbers(a), numbers(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

/** Where `latest` stands against a caret range: current, covered, major or unknown. */
export function rangeStatus(range, latest) {
  const floor = range.match(/^\^(\d+\.\d+\.\d+)$/)?.[1];
  if (!floor) return "unknown";
  if (floor === latest) return "current";
  // A caret holds the leftmost part that is not zero
  const [have, want] = [numbers(floor), numbers(latest)];
  const held = have.findIndex((part) => part !== 0);
  const sameLine = have.slice(0, held + 1).every((part, i) => part === want[i]);
  return sameLine && newer(latest, floor) ? "covered" : "major";
}

/**
 * Shopify ships an API version on the first day of each quarter. Its own
 * version table also lists versions that are only scheduled, so the calendar
 * decides what is due, and `listed` (the versions Shopify's library knows)
 * confirms it exists.
 */
export function shopifyVersions(today, listed) {
  const month = [10, 7, 4, 1].find((start) => start <= today.getUTCMonth() + 1);
  const due = `${today.getUTCFullYear()}-${String(month).padStart(2, "0")}`;
  const shipped = [...listed.matchAll(/['"](\d{4}-\d{2})['"]/g)].map((m) => m[1]).filter((version) => version <= due);
  return { due, latest: shipped.sort().at(-1) ?? null };
}

/** The Node runtimes in firebase-tools' table of supported runtimes. */
export function runtimes(source) {
  return [...source.matchAll(/nodejs(\d+):\s*\{([^}]*)\}/g)].map(([, node, body]) => ({
    node: Number(node),
    status: body.match(/status:\s*"([^"]+)"/)?.[1],
    deprecationDate: body.match(/deprecationDate:\s*"([^"]+)"/)?.[1],
  }));
}

/** The actions a workflow file uses, with the major each is held at. */
export function workflowActions(text) {
  return text.split("\n").flatMap((content, i) => {
    // Either @v7, or a commit SHA followed by a comment naming its version
    const used = content.match(/uses:\s*([\w.-]+\/[\w.-]+)@(?:v(\d+)|[0-9a-f]{40}\s*#\s*v(\d+))/);
    return used ? [{ action: used[1], major: Number(used[2] ?? used[3]), line: i + 1 }] : [];
  });
}

// ─── Reading the repository ──────────────────────────────────────────────
function textFiles(root, entry) {
  const full = path.join(root, entry);
  if (!fs.existsSync(full)) return [];
  if (!fs.statSync(full).isDirectory()) return TEXT_FILE.test(entry) ? [entry] : [];
  return fs.readdirSync(full).flatMap((name) => (name === "node_modules" ? [] : textFiles(root, `${entry}/${name}`)));
}

/** Every line, in the files that record it, that contains one of `needles`. */
function mentions(root, needles) {
  return VERSION_MENTIONS.flatMap((entry) => textFiles(root, entry)).flatMap((file) =>
    fs.readFileSync(path.join(root, file), "utf8").split("\n").flatMap((content, i) =>
      needles.some((needle) => content.includes(needle)) ? [{ file, line: i + 1 }] : [],
    ),
  );
}

function lineOf(root, file, needle) {
  const index = fs.readFileSync(path.join(root, file), "utf8").split("\n").findIndex((content) => content.includes(needle));
  return { file, line: index + 1 };
}

// ─── The check ───────────────────────────────────────────────────────────
async function fetchOverNetwork(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function check({ root = ROOT, today = new Date(), fetchText = fetchOverNetwork } = {}) {
  const findings = [];
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const latestOnNpm = async (name) => JSON.parse(await fetchText(`https://registry.npmjs.org/${name.replace("/", "%2f")}/latest`)).version;

  // A source that cannot be read leaves that subject unknown, never "fine"
  const look = async (subject, body) => {
    try {
      await body();
    } catch (error) {
      findings.push({ kind: "unknown", what: `${subject}: could not be checked`, detail: error.message, where: [] });
    }
  };

  await look("npm dependencies", async () => {
    const declared = {};
    for (const file of PACKAGE_FILES) {
      const pkg = JSON.parse(read(file));
      for (const [name, range] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
        (declared[name] ??= { range, where: [] }).where.push(lineOf(root, file, `"${name}"`));
      }
    }
    for (const [name, { range, where }] of Object.entries(declared)) {
      const latest = await latestOnNpm(name);
      const status = rangeStatus(range, latest);
      if (status === "major") {
        findings.push({ kind: "manual", what: `${name}: ${range} does not cover ${latest}, a new major`, detail: `Change to ^${latest}.`, where });
      } else if (status === "covered") {
        findings.push({ kind: "optional", what: `${name}: ${range} can be raised to ^${latest}`, detail: "Installs already get it. Raise it only alongside another update.", where });
      } else if (status === "unknown") {
        findings.push({ kind: "unknown", what: `${name}: the range ${range} is not a caret range`, detail: `Latest is ${latest}.`, where });
      }
    }
  });

  await look("Shopify API version", async () => {
    const pinned = read(API_VERSION_FILE).match(/API_VERSION = "(\d{4}-\d{2})"/)[1];
    const { due, latest } = shopifyVersions(today, await fetchText(SOURCES.shopifyVersions));
    if (latest && latest > pinned) {
      findings.push({
        kind: "auto",
        what: `Shopify API version: ${pinned} -> ${latest}`,
        detail: `Replace ${pinned} with ${latest} on each line below. The README badge writes it with a doubled dash.`,
        where: mentions(root, [pinned, pinned.replace("-", "--")]),
      });
    }
    if (due > (latest ?? "") && due > pinned) {
      findings.push({ kind: "unknown", what: `Shopify API version: ${due} is due by the calendar`, detail: "Shopify's library does not list it yet, so it stays as it is for now.", where: [] });
    }
  });

  await look("Functions runtime", async () => {
    const pinned = Number(JSON.parse(read(FIREBASE_JSON)).functions[0].runtime.replace("nodejs", ""));
    const table = runtimes(await fetchText(SOURCES.firebaseRuntimes));
    const mine = table.find((runtime) => runtime.node === pinned);
    if (!mine) throw new Error(`nodejs${pinned} is not in Firebase's runtime table`);
    const where = [
      lineOf(root, FIREBASE_JSON, `"runtime"`),
      ...PACKAGE_FILES.slice(1).map((file) => lineOf(root, file, `"node"`)),
    ];
    const newest = Math.max(...table.filter((runtime) => runtime.status === "GA").map((runtime) => runtime.node));
    if (newest > pinned) {
      findings.push({ kind: "manual", what: `Functions runtime: nodejs${pinned} -> nodejs${newest}`, detail: "Deploy to a real project before releasing a runtime change.", where });
    }
    const daysLeft = (new Date(mine.deprecationDate) - today) / 86400000;
    if (daysLeft < RETIRING_WITHIN_DAYS) {
      findings.push({ kind: "manual", what: `Functions runtime: nodejs${pinned} is deprecated on ${mine.deprecationDate}`, detail: "Move to a newer runtime before then.", where });
    }
  });

  await look("GitHub Actions", async () => {
    const workflows = path.join(root, ".github", "workflows");
    for (const name of fs.existsSync(workflows) ? fs.readdirSync(workflows) : []) {
      const file = `.github/workflows/${name}`;
      for (const { action, major, line } of workflowActions(read(file))) {
        const latest = JSON.parse(await fetchText(`https://raw.githubusercontent.com/${action}/HEAD/package.json`)).version;
        if (numbers(latest)[0] > major) {
          findings.push({ kind: "manual", what: `${action}: v${major} -> v${numbers(latest)[0]}`, detail: "Workflow files are changed by a person.", where: [{ file, line }] });
        }
      }
    }
  });

  await look("Firebase and Shopify CLIs", async () => {
    for (const [name, tested] of Object.entries(TESTED_TOOLS)) {
      const latest = await latestOnNpm(name);
      if (numbers(latest)[0] > tested) {
        findings.push({ kind: "manual", what: `${name} ${latest} is out; Nitrogen was last run against ${tested}.x`, detail: "Run the CLI with it on a real project, then raise TESTED_TOOLS in tools/check-updates.js.", where: [] });
      }
    }
  });

  return findings;
}

// ─── Report ──────────────────────────────────────────────────────────────
export function report(findings) {
  const count = (kind) => findings.filter((finding) => finding.kind === kind).length;
  const lines = findings.flatMap(({ kind, what, detail, where }) => [
    `${kind.padEnd(9)} ${what}`,
    `          ${detail}`,
    ...where.map((place) => `            ${place.file}:${place.line}`),
  ]);
  const todo = count("auto") + count("manual");
  const summary = todo === 0 && count("unknown") === 0
    ? "Nothing to update."
    : `${count("auto")} auto, ${count("manual")} manual, ${count("optional")} optional, ${count("unknown")} unknown`;
  return [...lines, lines.length ? "" : null, summary].filter((line) => line !== null).join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = await check();
  console.log(process.argv.includes("--json") ? JSON.stringify(findings, null, 2) : report(findings));
  const has = (kind) => findings.some((finding) => finding.kind === kind);
  process.exit(has("auto") || has("manual") ? 1 : has("unknown") ? 2 : 0);
}
