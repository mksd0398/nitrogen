// The schema check: every query the templates send must exist in the Shopify
// API version they pin. These tests use a small local schema; the real check
// (npm run check:graphql) fetches Shopify's.

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildSchema, introspectionFromSchema } from "graphql";
import { documents, problems, schemaFrom } from "../tools/check-graphql.js";

const TEMPLATES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");

const schema = buildSchema(`
  type Query { shop: Shop  product(id: ID!): Product }
  type Shop { name: String  tier: String  plan: String @deprecated(reason: "Use tier instead.") }
  type Product { id: ID!  title: String }
`);

test("a query that fits the schema has no problems", () => {
  assert.deepEqual(problems(schema, "query ($id: ID!) { shop { name tier } product(id: $id) { title } }"), { errors: [], deprecated: [] });
});

test("a field the schema does not have is an error", () => {
  const { errors } = problems(schema, "{ shop { name owner } }");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /owner/);
});

test("a deprecated field still works, and is reported with its replacement", () => {
  const { errors, deprecated } = problems(schema, "{ shop { plan } }");
  assert.deepEqual(errors, []);
  assert.equal(deprecated.length, 1);
  assert.match(deprecated[0], /plan/);
  assert.match(deprecated[0], /Use tier instead/);
});

test("a query that does not parse is an error, not a crash", () => {
  const { errors } = problems(schema, "{ shop { name ");
  assert.equal(errors.length, 1);
});

test("a real service's schema is used as it is, even where a strict reading rejects it", () => {
  // Shopify's schema deprecates fields on a type whose interface does not,
  // which graphql refuses to validate against unless told the schema is real
  const quirky = buildSchema(
    `interface Node { id: ID! }
     type Thing implements Node { id: ID! @deprecated(reason: "Old.")  name: String }
     type Query { thing: Thing }`,
    { assumeValid: true },
  );
  const fromService = schemaFrom(introspectionFromSchema(quirky));
  assert.deepEqual(problems(fromService, "{ thing { name } }"), { errors: [], deprecated: [] });
  assert.equal(problems(fromService, "{ thing { missing } }").errors.length, 1);
});

test("the same queries are found in both templates, and none in comments", () => {
  const js = documents(path.join(TEMPLATES, "js", "functions", "src"));
  const ts = documents(path.join(TEMPLATES, "ts", "functions", "src"));
  assert.ok(js.length >= 3, `found only ${js.length} queries`);
  const text = (list) => list.map((document) => document.source.replace(/\s+/g, " ").trim()).sort();
  assert.deepEqual(text(ts), text(js));
  // shopify.js shows `{ ... }` in a comment as an example; that is not a query
  for (const document of [...js, ...ts]) {
    assert.ok(!document.source.includes("..."), `${document.file}:${document.line} is a comment example`);
    assert.match(document.file, /^api\//);
  }
});
