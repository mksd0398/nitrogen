// Run by `npm version`: plugin.json, the manifest GitHub Copilot installs the
// plugin from, must carry the same version as package.json.

import fs from "node:fs";

const file = new URL("../plugin.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
manifest.version = process.env.npm_package_version;
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
