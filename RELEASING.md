# Releasing

A release starts when a new `version` in `package.json` reaches `master`.
`.github/workflows/publish.yml` then:

1. tests both templates;
2. checks their queries against Shopify's schema;
3. publishes to npm via trusted publishing (OIDC, so there is no `NPM_TOKEN`);
4. tags the commit.

```bash
npm version patch --no-git-tag-version   # or minor / major
# commit it, open a pull request, merge it
```

`npm version` also sets the version in `plugin.json`, the manifest GitHub
Copilot installs the plugin from, and in the agent skill's pinned `npx`
command; a test fails if either differs.

Pushing a `v*` tag, or running the workflow by hand on `master`, starts the same
release. All three are safe to repeat: the workflow skips a version that is
already on npm.

Every pull request runs `.github/workflows/test.yml`: the full test suite and
the schema check, on Node 24.

---

## Staying current

Two checks say whether anything Nitrogen pins has fallen behind:

```bash
npm run check:updates   # dependencies, Shopify API version, runtime, actions, CLIs
npm run check:graphql   # the templates' queries against Shopify's real schema
```

`check:updates` prints the lines to change for each finding, and marks it:

| Kind | Meaning |
|---|---|
| `auto` | Safe to apply once the tests pass. Today that is a new Shopify API version. |
| `optional` | A dependency range that could be raised. Installs already get the newer version, so it is not a reason to release on its own. |
| `manual` | Needs a person: a new major of a dependency, a new Functions runtime, a GitHub Actions change, or a new major of the Firebase or Shopify CLI. Tests cannot prove these work on a real Firebase project. |
| `unknown` | A source could not be read, so nothing is known either way. |

`check:graphql` fails when a query no longer fits the schema, and lists
deprecated fields so they can be replaced before Shopify removes them. The
templates' own tests stub Shopify and cannot see either. Check a version before
moving to it with `npm run check:graphql -- --version=2026-10`.

### The weekly routine

A Claude Code routine runs `check:updates` every Sunday at 2:00 PM IST, in
Anthropic's cloud. It is managed at https://claude.ai/code/routines.

- **Nothing behind:** it stops, having changed nothing.
- **`auto` findings:** it makes the change on a branch, bumps the version, adds a
  changelog entry, runs both test suites and opens a pull request. A second agent
  reviews the diff against fixed rules. When that review and the Test workflow
  both pass, it merges the pull request, which releases it.
- **`manual` findings, a failed test or a rejected review:** it opens a pull
  request or an issue titled "Needs you: ..." and never merges it.

It acts as the repository owner on GitHub, so GitHub sends no notification for
what it opens. npm sends an email for each version it publishes.

After checking a new major of the Firebase or Shopify CLI on a real project,
raise `TESTED_TOOLS` in `tools/check-updates.js`.

---

## Trusted Publisher

The workflow can only publish once npm trusts it. On npmjs.com →
`@mksd0398/nitrogen` → **Settings → Trusted Publisher**:

| Field | Value |
|---|---|
| Organization or user | `mksd0398` |
| Repository | `nitrogen` |
| Workflow filename | `publish.yml` |
| Environment | `Production`, the same value as `environment:` in the workflow |

Without it npm answers the upload with a bare `404`. The workflow's last step
prints what npm logged about the identity exchange when that happens.

---

## Verifying

```bash
npm view @mksd0398/nitrogen version
npx --yes --prefer-online @mksd0398/nitrogen --version
```

If you have a local `npm link` from development, unlink it first or you will be
testing your working tree rather than the published package:

```bash
npm unlink -g @mksd0398/nitrogen
```
