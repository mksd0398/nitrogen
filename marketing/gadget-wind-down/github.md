# GitHub

GitHub is where people evaluate the tool after they click through, so the repo
should answer "does this work for a Gadget app?" without them asking.

## 1. README section (added in this change)

A short "Coming from Gadget?" section near the top of the README, linking the
migration guide. It's committed alongside these files.

## 2. Pinned Discussion (Announcements category)

Turn on Discussions in the repository settings if it's off, post this, and pin it.

**Title:** Migrating from Gadget? Start here

**Body:**

Gadget is [winding down](https://gadget.dev/blog/gadget-wind-down): existing apps run
until **March 31, 2027**, no new apps can be started, and first-time production
deploys close at the **end of November 2026**.

If you're moving a Gadget Shopify app to Firebase, the
[migration guide](../blob/main/marketing/gadget-wind-down/migration-guide.md) covers:

- which Gadget features map to what (models, actions, webhooks, scheduled and background actions, secrets)
- keeping your existing Shopify app, so merchants don't reinstall
- replacing Shopify data sync, which is the part that takes real work
- moving data into Firestore and keeping GDPR deletion working
- a cutover checklist and what it costs

**Reply below with what your Gadget app does** (models, which Shopify data you sync,
background jobs). The most common gaps become features or examples in the next
release. The likely candidates are a scheduled-function example, a Cloud Tasks queue
example and a webhook-to-Firestore sync example.

## 3. Issue label and template

- Add a `gadget-migration` label.
- Add `.github/ISSUE_TEMPLATE/gadget-migration.yml` asking for: what the Gadget app
  does, which models are synced from Shopify, background/scheduled actions, rough
  number of installs, and what's blocking.

## 4. Release note

Ship the next release (even a small one, e.g. a scheduled-function example) with a
release note headed "For teams leaving Gadget". Releases notify watchers, and
release pages rank in search.

## 5. Repository topics

Add the topics `gadget-alternative` and `gadget-migration` (Settings → About).
People search GitHub topics directly.

## 6. Answer in the right places

- Gadget's community forum and Discord thread on migration: reply with the comment
  template from `reddit.md`, where it answers someone's question.
- GitHub issues in Gadget-based open-source Shopify apps that ask "what now?":
  link the guide. Don't open unsolicited issues or PRs on other people's repos to
  promote Nitrogen.
