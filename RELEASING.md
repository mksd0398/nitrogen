# Releasing

Releases are automatic: push a `v*` tag and `.github/workflows/publish.yml`
tests both templates, then publishes to npm via trusted publishing (OIDC — there
is no `NPM_TOKEN`).

```bash
npm version patch   # or minor / major — commits and tags
git push && git push --tags
```

The workflow skips itself if the version is already on npm, so re-running a tag
is safe.

---

## Trusted Publisher

The workflow can only publish once npm trusts it. On npmjs.com →
`@mksd0398/nitrogen` → **Settings → Trusted Publisher**:

| Field | Value |
|---|---|
| Organization or user | `mksd0398` |
| Repository | `nitrogen` |
| Workflow filename | `publish.yml` |
| Environment | *(leave blank)* |

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
