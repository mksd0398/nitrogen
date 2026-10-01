// What an AI agent (or any script) gets when it runs the CLI: no terminal to
// answer questions in, and nobody to ask before files are replaced.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "create.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nitrogen-agent-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// stdin is a pipe here, as it is under an agent's shell tool
function cli(args, { cwd = tmp, env = {} } = {}) {
  const { SHOPIFY_API_SECRET, ...rest } = process.env;
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    input: "",
    encoding: "utf8",
    env: { ...rest, ...env },
    timeout: 120000,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function folderWithFile(name) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "keep.txt"), "user work");
  return dir;
}

const CI = ["--api-key=test-client-id", "--api-secret=test-secret", "--project-id=nitrogen-agent-test", "--language=javascript", "--skip-provision"];

test("without a terminal or flags, it fails and names the flags to pass", () => {
  const { status, output } = cli(["agent-app", "--skip-shopify"]);
  assert.equal(status, 1);
  assert.match(output, /--api-key/);
  assert.match(output, /--project-id/);
  assert.match(output, /SHOPIFY_API_SECRET/);
  assert.equal(fs.existsSync(path.join(tmp, "agent-app")), false);
});

test("the client secret can come from SHOPIFY_API_SECRET instead of the command line", () => {
  folderWithFile("from-env");
  const { status, output } = cli(["from-env", "--api-key=test-client-id", "--project-id=nitrogen-agent-test", "--skip-shopify"], {
    env: { SHOPIFY_API_SECRET: "test-secret" },
  });
  // Reaching the folder check means the flags and the variable were accepted
  assert.equal(status, 1);
  assert.match(output, /--overwrite/);
});

test("a folder that already has files is never replaced without --overwrite", () => {
  const dir = folderWithFile("existing-app");
  const { status, output } = cli(["existing-app", ...CI]);
  assert.equal(status, 1);
  assert.match(output, /--overwrite/);
  assert.equal(fs.readFileSync(path.join(dir, "keep.txt"), "utf8"), "user work");
});

test("the current folder is never replaced, even with --overwrite", () => {
  const dir = folderWithFile("current");
  const { status, output } = cli([".", ...CI, "--overwrite"], { cwd: dir });
  assert.equal(status, 1);
  // Windows refuses to delete the current folder on its own; other systems do not
  assert.match(output, /running this from/);
  assert.equal(fs.readFileSync(path.join(dir, "keep.txt"), "utf8"), "user work");
});

test("a project folder is new, occupied, or holds the current directory", async () => {
  const { outputDirState } = await import("../lib/index.js");
  const parent = folderWithFile("parent");
  const child = path.join(parent, "child");
  fs.mkdirSync(child);

  assert.equal(outputDirState(path.join(tmp, "missing"), tmp), "new");
  assert.equal(outputDirState(child, tmp), "new");
  assert.equal(outputDirState(parent, tmp), "occupied");
  assert.equal(outputDirState(parent, parent), "holds-cwd");
  assert.equal(outputDirState(parent, child), "holds-cwd");
});
