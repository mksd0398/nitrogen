# Changelog

## 3.2.0

### Added

- **The wizard asks who the app is for.** "One store" makes a single-tenant
  app locked to that store: every other shop is refused at install, on the
  API, on webhooks and on the storefront proxy. "Many stores" makes a
  multi-tenant app. `--shop` answers the question up front. The choice is
  `ALLOWED_SHOPS` in `functions/.env`, so it can be changed later.

### Fixed

- **Spacing in the dashboard pages.** Cards on Settings and Components sat
  flush against each other, because a wrapper element stopped the page from
  spacing them. Sections are now direct children of the page.
- The empty state on Products had no padding: `padding="large-1200"` is not a
  Polaris value.
- Headings rendered as plain text: `<s-text variant="heading…">` does nothing.
  They are `<s-heading>` now.
- `background="bg-surface-secondary"` is not a Polaris value either; it is
  `subdued`.
- The stylesheet's universal margin and padding reset also applied to Polaris
  elements. It now covers plain HTML only.

## 3.1.3

### Fixed

- A client secret stored with a trailing newline no longer fails every
  signature check. Secrets set from a file often carry one.
- A refused webhook now logs its topic and shop, so a stray app still pointed
  at your URL can be told apart from a wrong secret.

## 3.1.2

### Changed

- The wizard asks where the functions should run, offering the region next to
  the database first. `--region` skips the question.
- No Firestore region is preselected. `asia-south1` used to be highlighted, so
  pressing Enter put the database in Mumbai.
- Generated projects run on Node.js 24, the newest runtime Cloud Functions
  supports.

## 3.1.1

### Changed

- Generated projects start from `firebase-admin` 14.5 and `firebase-functions` 7.4.
- The README no longer carries notes about the package's previous name.

### Fixed

- Releases publish from GitHub Actions. The workflow now names the `Production`
  environment its npm Trusted Publisher is registered with.

## 3.1.0

Changes what a newly scaffolded project contains. The CLI's own flags and
prompts are unchanged apart from the new `--region`.

### Security

- **Webhooks no longer accept unsigned requests.** The check was
  `if (req.rawBody && hmac && !verify(...))`, so a request with no HMAC header
  skipped verification entirely. An unsigned `app/uninstalled` POST naming any
  shop deleted that shop's access token. A missing header or body now means no.
  Apps scaffolded before 3.1.0 carry this until patched by hand: the README's
  Security section has the two-line fix.
- The client secret moved from `functions/.env` to Secret Manager. Everything in
  `functions/` is baked into the deployed container. The CLI stores the secret
  for you, and writes `functions/.secret.local` for the emulator only.
- Session tokens are verified with `audience`, and the shop they name is checked
  against `*.myshopify.com` and against `dest`.
- The JavaScript template's OAuth nonce now expires after 10 minutes and is burned
  before it is validated, as the TypeScript template's already was.
- An unexpected error in a route is logged and answered with
  `Internal server error`. It used to return `err.message`.
- Settings are validated by type and length, not only by key.
- Hosting sends `Content-Security-Policy: frame-ancestors` limited to Shopify and
  `X-Content-Type-Options: nosniff`.

### Changed

- **One Cloud Function per API resource** replaces the single Express `api`
  function: `shop`, `products`, `settings`, `keys`, `status`. Each scales, times
  out and deploys on its own. `index` is the API surface, and a route is an entry
  in a table passed to `endpoint()`.
- Express and `cors` are no longer dependencies. The embedded admin is served
  from the same origin as its API, so it never needed CORS.
- The functions region is no longer hard-coded to `us-central1`. It follows the
  Firestore location, or `--region`, and is written to both `APP_REGION` and
  every rewrite in `firebase.json`.
- TypeScript projects build before a functions deploy (`predeploy`).
- JS and CSS are served `no-cache`, so a deploy never runs new HTML with old
  scripts.
- `shop/redact` deletes the shop's session and settings instead of logging a TODO.

### Added

- **Multi-tenancy across apps.** Several Shopify apps can share one backend. The
  app is whichever one's secret verifies the request, never a value the caller
  sends, and every tenant's data is keyed by shop and app.
- **API keys** for callers outside Shopify: hashed at rest, scoped, owned by one
  tenant, managed from a new API keys page. Off unless a function opts in.
- **Rate limits**: `maxInstances` as a spending cap, a per-caller request limit
  in `endpoint()`, and Shopify's own throttling passed on as `429`.
- **A test suite in every generated project.** `npm test` needs no emulator or
  network and covers the verifiers, routing, tenant isolation, API keys, rate
  limits, and that `index` and `firebase.json` agree.
- `apiFetch` retries a `401` once with a fresh session token, and verification
  allows 10 seconds of clock tolerance. A token minted late in its minute used to
  stop a multi-request job part way through.
- A revoked access token is dropped and re-obtained by token exchange instead of
  failing every call until reinstall.
- Access tokens are cached in the instance for 5 minutes, so a busy shop costs
  one Firestore read per 5 minutes rather than one per request.
- Shopify API deprecation warnings and webhook API version drift are logged.
- `npm test` and `npm run test:e2e` for this repository: both templates are
  scaffolded and checked, and must expose the same routes.

### Fixed

- The README's cost section. It divided the free request quota by usage and
  ignored compute, which is what runs out first, and it said no billing account
  was needed when Cloud Functions require Blaze. The figures are now derived from
  the operations the template actually performs.


## 3.0.0

### Changed

- Named **Nitrogen**. The package is `@mksd0398/nitrogen`, and the command it
  installs is `nitrogen`. Nitrogen follows the element naming of Shopify's
  own developer products - Hydrogen, Oxygen - and reads as the inert 78% of
  the atmosphere that everything else runs inside, which is what a
  zero-framework scaffolder is.
- Published under a scope because the bare `nitrogen` name on npm belongs to
  an actively maintained React Native project. Scoping also matches how
  Shopify ships its own packages: `@shopify/polaris`, `@shopify/app-bridge`.
- Added an explicit statement that Nitrogen is an independent community
  project, not affiliated with or endorsed by Shopify Inc.
- The GitHub repository is `mksd0398/nitrogen`.
- No functional changes from 2.2.2.

## 2.2.2

### Fixed

- Get an access token the way a real install actually provides one. Apps built
  with the Shopify CLI use managed installation by default: Shopify grants the
  scopes and loads the embedded app **without ever calling `/auth`**. The
  scaffold only implemented the legacy authorization-code grant, so a normal
  install - the Install button, or a custom distribution link - left no token
  in Firestore and every Admin API call answered "Shop not authenticated".
  Reaching the app only worked if you visited `/auth?shop=...` by hand, which
  is not a path any merchant takes.

  The backend now performs token exchange: the App Bridge ID token that
  `verifySessionToken` already validates is exchanged for an offline access
  token on first use and stored in `shopSessions`. No redirect, no consent
  screen, and it works on the very first load.

  A stale ID token (Shopify answers 400, and they expire in about a minute) is
  returned as a 401 with `X-Shopify-Retry-Invalid-Session-Request`, so App
  Bridge fetches a fresh one and retries instead of surfacing an error.

  The `/auth` and `/auth/callback` routes are unchanged, so an app still on the
  legacy install flow keeps working.

## 2.2.1

### Fixed

- Pause for the Blaze upgrade instead of failing on it. Cloud Functions cannot
  deploy without billing, and the run used to print a one-line note, continue,
  and die minutes later inside the container build. It now stops before the
  deploy, offers to open the upgrade page, waits for confirmation, and then
  carries on with the deploy and the Shopify update in the same run.
- Skip the deploy entirely when the user declines the upgrade, rather than
  spending minutes reaching a known failure. The summary then leads with the
  upgrade link instead of claiming the app is ready.
- A deploy that fails on a Spark project no longer suggests raising
  `FUNCTIONS_DISCOVERY_TIMEOUT`, which cannot help a billing rejection.
- Never offer to create a Firebase project that was just created. The scaffold
  creates it, then provisioning re-derived existence from `projects:list`,
  which is eventually consistent. On a slow index that came back empty and
  prompted "Create Firebase project X?" for a project that already existed -
  and the second `projects:create` then died on "already exists", aborting the
  run with nothing provisioned.
- Stop misreading firebase-tools failures. The captured stderr is often just an
  ora spinner frame ("- Creating Google Cloud Platform project"), so the
  "already exists" match missed and a recoverable state became a hard failure.
  Existence is now probed directly, and reported errors skip spinner noise.
- Always offer a Firestore region. `firestore:locations` needs the Firestore
  API, which a brand-new project does not have enabled yet, so it failed
  exactly when first needed - silently skipping the prompt and leaving the
  project with no database. It now falls back to a built-in region list.
- Don't print "Firebase authenticated" twice.

## 2.2.0

Fixes from real-world feedback on 2.1.0 — the scaffolded project now ends up in
the state a Shopify app is supposed to be in, and the deploy stops failing on
Windows.

### One `shopify.app.toml`, not two

`shopify app config link` writes its own `shopify.app.<name>.toml`, so every
scaffolded project ended up with two configs — and the CLI's was the active one.
That file carries the *remote* app's defaults: empty `access_scopes`, an
`application_url` of `https://shopify.dev/apps/default-app-home`, and matching
redirect URLs. The correct values written by this tool sat in `shopify.app.toml`
where nothing read them, so `shopify app deploy` would have pushed placeholders
to Shopify.

Linking now harvests the Client ID, handle, organization id and app name from
whatever the CLI wrote — in the project directory or, as it sometimes does, the
parent — reads the Client Secret while that file is still on disk, then removes
it. Projects ship a single `shopify.app.toml`, the layout every Shopify template
uses. The CLI's file is only deleted once the Client ID is safely captured, so a
failed link leaves it in place.

`[build] include_config_on_deploy = true` was added to the template so
`shopify app deploy` actually uploads the URLs and scopes in that file.

### The app name is asked once

Both this wizard and the Shopify CLI asked for it. The Shopify CLI's answer is
the one the Partner Dashboard shows, so it wins: the name is read back from the
linked config and flows into the Firebase web app name, the page titles and the
app config. The prompt now only appears under `--skip-shopify`, where nothing
else would ask.

### `--distribute` opens the right page

The old URL — `partners.shopify.com/apps/<clientId>/distribution` — is not a
real route. The dashboard addresses apps by numeric organization and app ids,
and neither appears in `shopify.app.toml`. The ids are now scraped from a
dashboard link the Shopify CLI prints (`shopify app versions list`) and used to
build `https://partners.shopify.com/org/<org>/org_apps/<app>/distribution`,
falling back to the organization's app list and then to the Partners home.

The URL is printed as its own block before the browser opens, and when the exact
link cannot be resolved that is stated rather than silently opening the wrong
page. `--distribute` also recognises the Shopify CLI's named config files, so it
works in projects that were not scaffolded here.

### Firebase deploy no longer times out on the first run

`firebase deploy` boots the functions codebase and polls it for a manifest,
giving up after 10 seconds. A first load on Windows — cold `node_modules`,
antivirus reading every file — routinely takes longer and failed the whole
deploy with `User code failed to load. Cannot determine backend specification.`
The deploy step now runs with `FUNCTIONS_DISCOVERY_TIMEOUT=120`, and the failure
message explains how to set it by hand.

### Also

- `--app-name` still works for CI; the help text says when it is needed.
- Corrected a stale `Shopify API 2026-01` line in `--help` (the template ships
  2026-07).
