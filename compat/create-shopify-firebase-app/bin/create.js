#!/usr/bin/env node

/**
 * create-shopify-firebase-app — deprecated forwarding shim.
 *
 * The tool is now Nitrogen, published as @mksd0398/nitrogen. This package
 * exists only so that existing commands, docs and CI scripts keep working.
 * It prints a one-time notice and hands every argument to Nitrogen unchanged,
 * in-process, so interactive prompts and TTY colours behave identically.
 *
 * This shim is frozen. All development happens in @mksd0398/nitrogen.
 */

const c = process.stdout.isTTY
  ? { y: "\x1b[33m", b: "\x1b[1m", cy: "\x1b[36m", d: "\x1b[2m", r: "\x1b[0m" }
  : { y: "", b: "", cy: "", d: "", r: "" };

console.log(
  [
    "",
    `  ${c.y}▲${c.r}  ${c.b}create-shopify-firebase-app is now Nitrogen.${c.r}`,
    "",
    `     This package forwards to ${c.b}@mksd0398/nitrogen${c.r} and receives no updates.`,
    `     Switch to:  ${c.cy}npx @mksd0398/nitrogen${c.r}`,
    "",
    `     ${c.d}Nothing changes inside a generated project — only the command.${c.r}`,
    "",
  ].join("\n")
);

let run;
try {
  ({ run } = await import("@mksd0398/nitrogen/lib/index.js"));
} catch (err) {
  console.error(
    `\n\x1b[31mError:\x1b[0m could not load @mksd0398/nitrogen (${err.code || err.message}).` +
      `\nInstall it directly instead:  npx @mksd0398/nitrogen\n`
  );
  process.exit(1);
}

run(process.argv.slice(2)).catch((err) => {
  console.error("\n\x1b[31mError:\x1b[0m", err.message);
  process.exit(1);
});
