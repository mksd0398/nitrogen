# Other channels

## dev.to, Hashnode, Medium

Publish `migration-guide.md` as is. The front matter is dev.to's format:
`canonical_url` points at the GitHub copy so the search credit isn't split across
sites. On Hashnode and Medium, set the same canonical URL in the post settings.
Tags: `shopify`, `firebase`, `serverless`, `webdev`.

Suggested title variants to A/B across platforms:

- Gadget is shutting down. Here's how to move your Shopify app to Firebase
- Leaving Gadget: a concept-by-concept map to Firebase for Shopify apps
- You have until March 31, 2027: migrating a Gadget Shopify app

---

## Hacker News

HN reacts to the news, not the tool. Submit the tool as a Show HN *only* on a day
there's no Gadget story on the front page, and be ready to talk architecture.

**Title:** Show HN: Nitrogen – Shopify apps on Firebase, one command from zero to install link

**First comment (post right after submitting):**

I built Nitrogen because every Shopify app I started meant a Remix server running
24/7 for a dashboard used ten minutes a day. It generates a Shopify embedded app on
Cloud Functions gen 2, Firestore and Hosting, with one function per API resource,
plain HTML pages with Polaris web components, and no build step for the frontend.

One command creates the Shopify app, creates and provisions the Firebase project,
puts the client secret in Secret Manager, deploys, and prints an install link.

It's timely because Gadget, a hosted Shopify app platform, just announced it's
shutting down (apps run until March 31, 2027), and many of its users chose it for
the same reason: no server to run, nothing billed when idle. The difference is that
all the code ends up in your repo; there's no runtime of mine in the middle.

Things I'd love feedback on: the one-function-per-resource split (cold starts vs
isolation), and the cost model. I estimate ~1,200 daily active stores in the free
tier, with the working in the README.

---

## X / Twitter thread

1/ Gadget is shutting down.

Shopify apps on it keep running until March 31, 2027. No new apps from today. First-time prod deploys close end of November.

If you built on Gadget, here's a calm migration plan 🧵

2/ First, list what you actually use:
• hosting
• database
• Shopify auth
• webhooks + GDPR
• data sync
• background jobs
• admin UI

Most apps: auth + webhooks + a few models + a small UI. Those port quickly. Data sync is the real work.

3/ Before rebuilding data sync, ask: do I need a local copy at all?

Often calling the Admin API when the merchant clicks is enough. Then nothing goes stale and there's nothing to backfill.

4/ Where to go:
• Shopify's template: most common, but you run a server
• Cloudflare Workers + D1
• Firebase: scales to zero like Gadget

5/ For Firebase I maintain Nitrogen (open source):

npx @mksd0398/nitrogen my-app

It creates the Shopify app and the Firebase project, stores the secret, deploys, and gives you an install link. Auth, webhooks, GDPR and an admin UI are in, along with tests.

6/ Migrating without merchants reinstalling: point it at your *existing* app's client ID. Token exchange issues new tokens on the first request.

7/ Cost: $0 idle. ~1,200 daily active stores fit in Firebase's free tier (working in the README).

Full guide: https://github.com/mksd0398/nitrogen/blob/main/marketing/gadget-wind-down/migration-guide.md

---

## LinkedIn

Gadget, a platform many Shopify app businesses run on, is shutting down. Apps keep
working until March 31, 2027, and then they stop.

If your business, or a client's, depends on a Gadget app, now is the time to plan,
not March. The work is mostly predictable: auth, webhooks and the admin UI move
quickly. Replacing Shopify data sync is where the time goes.

I maintain Nitrogen, an open-source tool that generates a Shopify app on Google
Firebase. It costs nothing when idle, and every line of code is in your own
repository, so a vendor decision can't switch it off. I've written a step-by-step
migration guide that's useful whichever platform you choose:

https://github.com/mksd0398/nitrogen/blob/main/marketing/gadget-wind-down/migration-guide.md

#Shopify #ShopifyApps #Firebase #Ecommerce

---

## Discord (Gadget's migration channel, Shopify dev servers)

Only where people are asking where to move. One message, then answer replies.

> For anyone looking at Firebase as the landing spot: I maintain Nitrogen (MIT),
> `npx @mksd0398/nitrogen my-app`. It sets up a Shopify app on Cloud Functions +
> Firestore with auth, webhooks, GDPR and an admin UI, and deploys it. I wrote a
> Gadget → Firebase concept map and cutover checklist:
> https://github.com/mksd0398/nitrogen/blob/main/marketing/gadget-wind-down/migration-guide.md
> Happy to help anyone mid-migration, whatever stack you pick.

---

## Shopify Community forums (Shopify Apps / Partners board)

**Title:** Migrating a Gadget app before the March 2027 shutdown: a checklist

Post the guide's "What you are actually replacing" list and the cutover checklist
(steps 1–5 summary) in the body, then link the full guide. Disclose that you
maintain Nitrogen in the first paragraph.

---

## Timing

| When | Where |
|---|---|
| Day 1 | GitHub: README section, pinned Discussion, topics |
| Day 1 | dev.to (canonical), then Hashnode and Medium |
| Day 2 | r/shopifyDev, X thread |
| Day 3 | r/Firebase, LinkedIn |
| Day 4 | Shopify Community forum, Discord where relevant |
| Day 5 | r/shopify (merchant PSA) |
| Week 2 | r/SaaS or r/indiehackers; Show HN on a quiet day |
| When Gadget publishes its migration tools | Update step 4 of the guide, then repost to dev.to as "Updated: …" |
| End of November | "First-time deploy window just closed" reminder post |
| January 2027 | "Ten weeks left" reminder post |
