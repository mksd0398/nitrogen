// The reference pages are generated from tools/reference/*.js and committed.
// These checks keep the committed pages, the data and the rest of the
// template in step.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "../tools/build-reference.js";
import { apis } from "../tools/reference/apis.js";
import { components } from "../tools/reference/components.js";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates", "web");
const read = (file) => fs.readFileSync(path.join(WEB, file), "utf8").replaceAll("\r\n", "\n");

test("the committed reference pages match their data", () => {
  for (const [file, content] of Object.entries(build())) {
    assert.equal(read(file), content, `${file} is out of date: run npm run build:reference`);
  }
});

test("every entry has a unique id and everything a section needs", () => {
  for (const [name, entries] of Object.entries({ components, apis })) {
    const ids = entries.map((entry) => entry.id);
    assert.deepEqual(ids, [...new Set(ids)], `${name} has a duplicate id`);
    for (const entry of entries) {
      assert.ok(entry.title && entry.summary && entry.group, `${name}/${entry.id} is incomplete`);
      assert.ok((entry.html || entry.code || "").trim(), `${name}/${entry.id} has no example`);
    }
  }
});

test("every component example uses the element it documents", () => {
  for (const entry of components) {
    assert.ok(entry.html.includes(`<${entry.tag}`), `${entry.id} never uses <${entry.tag}>`);
  }
});

test("ids used by examples are unique across a page", () => {
  for (const file of ["polaris.html", "apis.html"]) {
    const live = read(file).replace(/<pre>[\s\S]*?<\/pre>/g, "");
    const ids = [...live.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(repeated, [], `${file} repeats an id`);
  }
});

test("every page loads the same scripts and carries the same navigation", () => {
  const pages = fs.readdirSync(WEB).filter((file) => file.endsWith(".html"));
  assert.ok(pages.includes("apis.html") && pages.includes("polaris.html"));

  const nav = (page) => read(page).match(/<s-app-nav>[\s\S]*?<\/s-app-nav>/)?.[0].replace(/\s+/g, " ");
  for (const page of pages) {
    assert.equal(nav(page), nav("index.html"), `${page} has a different navigation`);
    assert.match(read(page), /shopifycloud\/app-bridge\.js/, page);
    assert.match(read(page), /shopifycloud\/polaris-1\.js/, `${page} should load the stable Polaris channel`);
  }
});

test("no page uses an element or attribute Polaris has replaced", () => {
  const outdated = /<ui-(nav-menu|modal|title-bar)|\shelpText=|\slabelHidden\b|\sclearButton\b|\smultiline\b|<s-text[^>]*\svariant=/;
  for (const file of fs.readdirSync(WEB, { recursive: true }).filter((f) => /\.(html|js)$/.test(f))) {
    const source = read(file).replaceAll("&lt;", "<").replaceAll("&gt;", ">");
    assert.doesNotMatch(source, outdated, file);
  }
});
