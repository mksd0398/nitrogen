// Generates the two reference pages of the web template from their data:
//
//   tools/reference/components.js -> templates/web/polaris.html
//   tools/reference/apis.js       -> templates/web/apis.html
//                                    templates/web/js/pages/apis.js
//
// The pages are plain HTML, committed to the repo, because a generated
// project has no build step. `npm test` fails when they are out of date.
//
//   npm run build:reference

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apis, groups as apiGroups } from "./reference/apis.js";
import { components, groups as componentGroups } from "./reference/components.js";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates", "web");

const NAV = [
  ["/", "Dashboard", ' rel="home"'],
  ["/products", "Products"],
  ["/settings", "Settings"],
  ["/keys", "API keys"],
  ["/polaris", "Components"],
  ["/apis", "App Bridge"],
];

const escapeHtml = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const indent = (text, spaces) =>
  text.split("\n").map((line) => (line ? " ".repeat(spaces) + line : line)).join("\n");

// `code` spans in a summary: `details` -> <code>details</code>
const prose = (text) => escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");

function head(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - {{APP_NAME}}</title>
  <link rel="stylesheet" href="/css/app.css">
  <meta name="shopify-api-key" content="{{API_KEY}}">
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
  <script src="https://cdn.shopify.com/shopifycloud/polaris-1.js"></script>
</head>
<body>
  <s-app-nav>
${NAV.map(([href, label, extra = ""]) => `    <s-link href="${href}"${extra}>${label}</s-link>`).join("\n")}
  </s-app-nav>
`;
}

function contents(groups, entries) {
  return `    <s-section heading="Contents">
      <s-stack gap="base">
${groups
  .map((group) => {
    const links = entries
      .filter((entry) => entry.group === group.id)
      .map((entry) => `            <s-link href="#${entry.id}">${entry.title}</s-link>`)
      .join("\n");
    return `        <s-stack gap="small-200">
          <s-heading>${group.title}</s-heading>
          <s-stack direction="inline" gap="base">
${links}
          </s-stack>
        </s-stack>`;
  })
  .join("\n")}
      </s-stack>
    </s-section>`;
}

function codeBlock(language, code) {
  return `      <div class="demo-code">
        <div class="code-block-header">
          <span>${language}</span>
          <button class="btn-copy" type="button" onclick="copyCode(this)">Copy</button>
        </div>
        <pre><code>${escapeHtml(code)}</code></pre>
      </div>`;
}

// ─── Components ───────────────────────────────────────────────────────────
function componentSection(entry) {
  const demo =
    entry.demo === false
      ? ""
      : `      <s-box padding="base" border="base" borderRadius="base">
${indent(entry.html, 8)}
      </s-box>
`;
  return `    <s-section heading="${entry.title}">
      <span id="${entry.id}" class="anchor"></span>
      <s-paragraph color="subdued"><code>&lt;${entry.tag}&gt;</code> ${prose(entry.summary)}</s-paragraph>
${demo}${codeBlock("HTML", entry.html)}
    </s-section>`;
}

function componentsPage() {
  return `${head("Components")}
  <s-page heading="Components">
    <s-link slot="breadcrumb-actions" href="/">Dashboard</s-link>

    <s-section>
      <s-paragraph>
        Every Polaris web component, each with a working example you can copy.
        They are plain HTML elements: no React, no build step, no imports.
      </s-paragraph>
    </s-section>

${contents(componentGroups, components)}

${components.map(componentSection).join("\n\n")}
  </s-page>

  <script src="/js/app.js"></script>
  <script src="/js/pages/reference.js"></script>
</body>
</html>
`;
}

// ─── App Bridge ───────────────────────────────────────────────────────────
const isMarkup = (entry) => entry.code.trimStart().startsWith("<");
const runs = (entry) => entry.run !== false && !isMarkup(entry);

function apiSection(entry) {
  const demo = entry.html
    ? `      <s-box padding="base" border="base" borderRadius="base">
${indent(entry.html, 8)}
      </s-box>
`
    : "";
  const run = runs(entry)
    ? `      <s-stack direction="inline" gap="base" alignItems="center">
        <s-button onclick="runDemo('${entry.id}')">Run</s-button>
        <s-text color="subdued">Runs the code below, inside the Shopify admin.</s-text>
      </s-stack>
      <pre class="demo-output" id="output-${entry.id}" hidden></pre>
`
    : "";
  const shown = entry.code.replaceAll("show(", "console.log(");
  return `    <s-section heading="${entry.title}">
      <span id="${entry.id}" class="anchor"></span>
      <s-paragraph color="subdued"><code>${escapeHtml(entry.call)}</code> ${prose(entry.summary)}</s-paragraph>
${demo}${run}${codeBlock(isMarkup(entry) ? "HTML" : "JavaScript", shown)}
    </s-section>`;
}

function apisPage() {
  return `${head("App Bridge")}
  <s-page heading="App Bridge">
    <s-link slot="breadcrumb-actions" href="/">Dashboard</s-link>

    <s-section>
      <s-paragraph>
        Everything your app can ask of the Shopify admin. App Bridge puts it all
        on one global object, <code>shopify</code>, so there is nothing to import.
        The Run buttons only work inside the Shopify admin.
      </s-paragraph>
    </s-section>

${contents(apiGroups, apis)}

${apis.map(apiSection).join("\n\n")}
  </s-page>

  <script src="/js/app.js"></script>
  <script src="/js/pages/reference.js"></script>
  <script src="/js/pages/apis.js"></script>
</body>
</html>
`;
}

function apisScript() {
  const demos = apis
    .filter(runs)
    .map((entry) => `    "${entry.id}": async function (show) {\n${indent(entry.code, 6)}\n    },`)
    .join("\n\n");
  return `/**
 * App Bridge page: the code behind each Run button.
 *
 * GENERATED from tools/reference/apis.js by \`npm run build:reference\` in the
 * Nitrogen repository. In your own project this is an ordinary file: edit it
 * freely, or delete the page once you no longer need the reference.
 */

(function () {
  "use strict";

  var demos = {
${demos}
  };

  window.runDemo = async function runDemo(id) {
    var output = document.getElementById("output-" + id);
    var lines = [];
    function show(value) {
      lines.push(typeof value === "string" ? value : JSON.stringify(value, null, 2));
      output.textContent = lines.join("\\n");
      output.hidden = false;
    }

    if (!window.shopify) {
      show("Open the app in the Shopify admin to run this.");
      return;
    }
    try {
      await demos[id](show);
    } catch (error) {
      show("Failed: " + (error && error.message ? error.message : error));
    }
  };
})();
`;
}

// ─── Agent skill references ───────────────────────────────────────────────
// The same entries as Markdown, for AI agents: skills/shopify-firebase-app/references/

const fence = (language, code) => `\`\`\`${language}\n${code}\n\`\`\``;

function markdown(title, intro, groups, entries, section) {
  const toc = groups.map((group) => {
    const names = entries.filter((entry) => entry.group === group.id).map((entry) => entry.title);
    return `- **${group.title}:** ${names.join(", ")}`;
  });
  const body = groups.map((group) =>
    [`## ${group.title}`, ...entries.filter((entry) => entry.group === group.id).map(section)].join("\n\n"),
  );
  return `# ${title}

<!-- Generated from tools/reference/ by \`npm run build:reference\`. Do not edit. -->

${intro}

${toc.join("\n")}

${body.join("\n\n")}
`;
}

function componentsMarkdown() {
  return markdown(
    "Polaris web components",
    "Every component a Nitrogen page can use, each with a working example. They are custom elements loaded by `<script src=\"https://cdn.shopify.com/shopifycloud/polaris-1.js\">` in `web/*.html`: plain HTML, no React, no build step, no imports. Polaris React (`<Page>`, `<Card>`, `@shopify/polaris`) does not apply here. Inside an app, the same examples render live on its Components page (`web/polaris.html`).",
    componentGroups,
    components,
    (entry) => `### ${entry.title}: \`<${entry.tag}>\`\n\n${entry.summary}\n\n${fence("html", entry.html)}`,
  );
}

function apisMarkdown() {
  return markdown(
    "App Bridge",
    "Everything a Nitrogen page can ask of the Shopify admin. `<script src=\"https://cdn.shopify.com/shopifycloud/app-bridge.js\">` in `web/*.html` puts it all on one global object, `shopify`, so there is nothing to import and no `createApp`. It only works inside the Shopify admin. Inside an app, each example runs from its App Bridge page (`web/apis.html`).",
    apiGroups,
    apis,
    (entry) => {
      const blocks = [];
      if (entry.html) blocks.push(fence("html", entry.html));
      blocks.push(fence(isMarkup(entry) ? "html" : "js", entry.code.replaceAll("show(", "console.log(")));
      return `### ${entry.title}: \`${entry.call}\`\n\n${entry.summary}\n\n${blocks.join("\n\n")}`;
    },
  );
}

// The guide every generated app carries as AGENTS.md, for apps made before
// it existed. Written for TypeScript; a JavaScript app has the same files in .js.
function appGuide() {
  const agents = fs.readFileSync(path.join(WEB, "..", "shared", "AGENTS.md"), "utf8").replaceAll("\r\n", "\n");
  return agents
    .replace(
      "# AGENTS.md\n",
      "# App guide\n\n<!-- Generated from templates/shared/AGENTS.md by `npm run build:reference`. Do not edit. -->\n",
    )
    .replaceAll("{{EXT}}", "ts");
}

export function build() {
  return {
    "templates/web/polaris.html": componentsPage(),
    "templates/web/apis.html": apisPage(),
    "templates/web/js/pages/apis.js": apisScript(),
    "skills/shopify-firebase-app/references/polaris.md": componentsMarkdown(),
    "skills/shopify-firebase-app/references/app-bridge.md": apisMarkdown(),
    "skills/shopify-firebase-app/references/app-guide.md": appGuide(),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.join(WEB, "..", "..");
  for (const [file, content] of Object.entries(build())) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
    console.log(`wrote ${file}`);
  }
}
