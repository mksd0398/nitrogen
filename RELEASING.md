# Releasing

Normal releases are automatic: push a `v*` tag and `.github/workflows/publish.yml`
publishes to npm via trusted publishing (OIDC — there is no `NPM_TOKEN`).

```bash
npm version patch   # or minor / major — commits and tags
git push && git push --tags
```

The workflow skips itself if the version is already on npm, so re-running a tag
is safe.

---

## One-time setup after the Nitrogen rename

These steps only apply once, while moving from `create-shopify-firebase-app` to
`@mksd0398/nitrogen`. **The order matters** — each step depends on the one
before it.

### 1. Rename the GitHub repository

`mksd0398/create-shopify-firebase-app` → `mksd0398/nitrogen`, via
**Settings → General → Repository name** on github.com.

GitHub permanently redirects the old URLs, so existing clones, links and forks
keep working. Then point your local clone at the new name:

```bash
git remote set-url origin https://github.com/mksd0398/nitrogen.git
```

The workflow's fork guard (`if: github.repository == 'mksd0398/nitrogen'`)
already expects the new name. Until the repository is actually renamed that
condition is false, and the publish job will **silently skip** rather than fail
— which is exactly why this step comes first.

### 2. Publish `@mksd0398/nitrogen` manually, once

Trusted publishing is configured per-package in npm's web UI, and npm only
exposes that setting on a package that already exists. So the very first
publish of a new package name cannot use the workflow:

```bash
npm login
npm publish --access public
```

`--access public` is required: scoped packages default to restricted (paid).
`publishConfig.access` in `package.json` covers this too.

### 3. Configure the Trusted Publisher

On npmjs.com → `@mksd0398/nitrogen` → **Settings → Trusted Publisher**:

| Field | Value |
|---|---|
| Organization or user | `mksd0398` |
| Repository | `nitrogen` |
| Workflow filename | `publish.yml` |
| Environment | *(leave blank)* |

From here on, tag pushes publish on their own.

### 4. Publish the compatibility shim

`compat/create-shopify-firebase-app/` is a frozen package that forwards the old
command to Nitrogen, so existing scripts and CI jobs keep working. It is
published once and then left alone:

```bash
cd compat/create-shopify-firebase-app
npm publish
```

It is unscoped and already exists on npm, so it needs no `--access` flag. It
depends on `@mksd0398/nitrogen@^3.0.0`, so step 2 must have landed first.

### 5. Deprecate the old name

```bash
npm deprecate create-shopify-firebase-app "Renamed to @mksd0398/nitrogen — use: npx @mksd0398/nitrogen my-app"
```

This applies to every published version including the shim, which is intended:
the shim still runs, it just tells people to move. Nothing is unpublished —
old versions stay installable for anyone pinning them.

### 6. Tag the release

Only now, with trusted publishing configured and the repository renamed:

```bash
git tag v3.0.0
git push --tags
```

The workflow sees 3.0.0 already on npm from step 2 and skips, which is correct.
Subsequent releases publish through it normally.

---

## Verifying

```bash
npm view @mksd0398/nitrogen version
npx @mksd0398/nitrogen --version          # resolves from the registry
npx create-shopify-firebase-app --version # prints the notice, then forwards
```

If you have a local `npm link` from development, unlink it first or you will be
testing your working tree rather than the published package:

```bash
npm unlink -g @mksd0398/nitrogen
```
