#!/usr/bin/env node

/**
 * Nitrogen
 *
 * Usage:
 *   npx @mksd0398/nitrogen my-app
 *   nitrogen my-app          (once installed)
 *   npx @mksd0398/nitrogen   (interactive)
 */

import { run } from "../lib/index.js";

run(process.argv.slice(2)).catch((err) => {
  console.error("\n\x1b[31mError:\x1b[0m", err.message);
  process.exit(1);
});
