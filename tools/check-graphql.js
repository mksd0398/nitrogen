// Checks every GraphQL query the templates send against the schema of the
// Shopify API version they pin:
//
//   npm run check:graphql                      the pinned version
//   npm run check:graphql -- --version=2026-10  a version you are moving to
//
// The templates' own tests stub Shopify, so they cannot notice a field that a
// new API version removed. This can: it reads the real schema from the public
// endpoint Shopify's code generator uses. A query that no longer fits fails
// the check; a deprecated field is listed so it can be replaced in time.
//
// Needs shopify.dev, which a restricted network may not reach. The Test
// workflow runs it on every pull request, where the network is open.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildClientSchema, getIntrospectionQuery, NoDeprecatedCustomRule, parse, validate } from "graphql";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_URL = "https://shopify.dev/admin-graphql-direct-proxy";

/** The queries passed to graphql(ctx, `...`) under `dir`, with where each is. */
export function documents(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return documents(full, base);
    if (!/\.(js|ts)$/.test(entry.name)) return [];
    const text = fs.readFileSync(full, "utf8");
    return [...text.matchAll(/graphql\(\s*ctx,\s*`([^`]*)`/g)].flatMap((match) => {
      const before = text.slice(0, match.index);
      // An example in a comment is not a query the app sends
      if (/^\s*(\*|\/\/)/.test(before.slice(before.lastIndexOf("\n") + 1))) return [];
      return [{ file: path.relative(base, full).replaceAll("\\", "/"), line: before.split("\n").length, source: match[1] }];
    });
  });
}

/** What is wrong with one query: `errors` break it, `deprecated` will later. */
export function problems(schema, source) {
  let document;
  try {
    document = parse(source);
  } catch (error) {
    return { errors: [error.message], deprecated: [] };
  }
  const messages = (rules) => validate(schema, document, rules).map((error) => error.message);
  return { errors: messages(), deprecated: messages([NoDeprecatedCustomRule]) };
}

/** A schema to check queries against, from a service's introspection result. */
export function schemaFrom(introspection) {
  // Shopify's schema deprecates some fields that an interface it implements
  // does not, which graphql rejects as an invalid schema. It is the schema the
  // API really serves, so it is taken as it is.
  return buildClientSchema(introspection, { assumeValid: true });
}

async function shopifySchema(version) {
  const response = await fetch(`${SCHEMA_URL}/${version}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: getIntrospectionQuery() }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`${SCHEMA_URL}/${version} answered HTTP ${response.status}`);
  return schemaFrom((await response.json()).data);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pinned = fs.readFileSync(path.join(ROOT, "templates/ts/functions/src/shopify.ts"), "utf8").match(/API_VERSION = "(\d{4}-\d{2})"/)[1];
  const version = process.argv.find((arg) => arg.startsWith("--version="))?.slice(10) || pinned;
  const schema = await shopifySchema(version);

  let broken = 0;
  let checked = 0;
  for (const language of ["js", "ts"]) {
    for (const { file, line, source } of documents(path.join(ROOT, "templates", language, "functions", "src"))) {
      const { errors, deprecated } = problems(schema, source);
      const where = `templates/${language}/functions/src/${file}:${line}`;
      for (const message of errors) console.log(`error       ${where}  ${message}`);
      for (const message of deprecated) console.log(`deprecated  ${where}  ${message}`);
      broken += errors.length;
      checked += 1;
    }
  }
  console.log(`${checked} queries checked against Shopify API ${version}: ${broken ? `${broken} broken` : "all valid"}`);
  process.exit(broken ? 1 : 0);
}
