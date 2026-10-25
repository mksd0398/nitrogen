// Run by `npm version`: plugin.json, the manifest GitHub Copilot installs the
// plugin from, and the skill's pinned `npx` command must carry the same
// version as package.json.

import fs from "node:fs";

const version = process.env.npm_package_version;

const file = new URL("../plugin.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
manifest.version = version;
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");

const skill = new URL("../skills/shopify-firebase-app/SKILL.md", import.meta.url);
const text = fs.readFileSync(skill, "utf8");
fs.writeFileSync(skill, text.replace(/@mksd0398\/nitrogen@\d+\.\d+\.\d+/g, `@mksd0398/nitrogen@${version}`));
