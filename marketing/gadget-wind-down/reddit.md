# Reddit posts

Reddit punishes anything that reads like an ad. Rules for every post below:

- **Read each subreddit's self-promotion rules first.** Some allow it only in a weekly
  thread. If so, post there.
- **Lead with the useful part, disclose early.** "I built this" goes in the first
  three lines, never hidden.
- **Post the guide's content in the body, not just a link.** Link posts from new
  accounts get filtered.
- **One subreddit a day**, different wording each time. Cross-posting identical text
  gets flagged as spam.
- **Stay in the thread for the first two hours** and answer every question,
  including "why not just use X".

---

## r/shopifyDev

**Title:** Gadget is shutting down (March 31, 2027). I wrote a concept-by-concept guide for moving a Gadget app to Firebase

**Body:**

If you missed it: Gadget announced it's winding down. Existing apps run until
**March 31, 2027**, no new apps can be started, and first-time production deploys
are allowed only until **end of November**. They say migration tools are coming in
the next few weeks.

Disclosure up front: I maintain Nitrogen, an open-source (MIT) CLI that scaffolds
Shopify apps on Firebase. So I'm biased, but I've tried to make this useful whatever
you pick.

**The thing worth doing first:** list which parts of Gadget your app actually uses.
Hosting, database, Shopify auth, webhooks, data sync, background jobs, frontend,
secrets. Most apps lean on auth + webhooks + a few models + a small admin UI, and
those are quick to rebuild anywhere. **Shopify data sync** is the part that takes
real work. Before rebuilding it, check whether you need a local copy at all, or
whether calling the Admin API on demand covers it.

**Rough map of where things go on Firebase:**

| Gadget | Firebase |
|---|---|
| Models | Firestore collections, keyed per shop |
| Actions / global actions | One Cloud Function per resource, routes return JSON |
| Shopify webhook triggers | HMAC-verified webhook function |
| Scheduled actions | `onSchedule` |
| Background actions | Cloud Tasks (`onTaskDispatched`) |
| Env vars / secrets | `.env` + Secret Manager |

**Options I'd honestly consider:**

- Shopify's own template (React Router): the most-trodden path, but you host a server.
- Cloudflare Workers + D1: someone shared [shopiflare](https://github.com/safwanadnan/shopiflare) on the Gadget forums.
- Firebase: scales to zero like Gadget, and this is what Nitrogen does.

`npx @mksd0398/nitrogen my-app` creates the Shopify app and the Firebase project,
stores the secret in Secret Manager, deploys, and gives you an install link. You get
OAuth/token exchange, session-token verification, GDPR webhooks, an embedded Polaris
admin and a test suite. To migrate without merchants reinstalling, you point it at
your *existing* app's client ID.

Cost: an idle app is $0, and by my arithmetic about 1,200 daily active stores fit in
the free tier (the README shows the working).

Where it's weaker than Gadget: no managed data sync, no generated client, no hosted
editor, and Firestore isn't relational.

Full guide (dates, mapping, data move, cutover checklist): https://github.com/mksd0398/nitrogen/blob/main/marketing/gadget-wind-down/migration-guide.md

Happy to answer questions about any stack, not just mine. What's everyone else
planning to move to?

---

## r/shopify

> r/shopify is mostly merchants. Aim this at merchants who paid someone to build an
> app on Gadget, and keep the tool mention to one line.

**Title:** PSA for merchants with a custom app: Gadget is shutting down on March 31, 2027

**Body:**

If a developer built a custom or private app for your store, it may run on Gadget.
Gadget has announced it's shutting down. Your app keeps working until **March 31,
2027**, then it stops.

**What to do now:**

1. Ask whoever built your app: "Does it run on Gadget?" (Signs: their invoices mention
   Gadget, or the app's URL ends in `gadget.app`.)
2. If yes, ask for a migration plan and a date well before March.
3. Make sure you, not just the developer, will own the new code and the hosting
   account.

There are several places to move to (Shopify's own app template, Cloudflare,
Firebase). Disclosure: I maintain an open-source one for Firebase,
[Nitrogen](https://github.com/mksd0398/nitrogen), and wrote up a migration guide
your developer can use. But any of them is fine. The important bit is not finding
out in April.

---

## r/Firebase

**Title:** Gadget (Shopify app platform) is shutting down. Firebase is a pretty natural landing spot. Here's the mapping

**Body:**

Gadget was popular for building Shopify apps without running a server. It's
shutting down on March 31, 2027, so a lot of Shopify devs are about to shop for a
new backend. Firebase lines up with what they liked about it: scale to zero, managed
DB, secrets, no servers.

I maintain [Nitrogen](https://github.com/mksd0398/nitrogen) (MIT), a CLI that
scaffolds a Shopify app on Cloud Functions gen 2 + Firestore + Hosting. Some design
choices that might interest this sub regardless of Shopify:

- **One function per API resource**, not one Express app behind `/api/**`, so a slow
  CSV import can't starve the routes merchants are waiting on. Hosting rewrites with
  `run.serviceId` route each path. A test fails if `index.ts` exports and
  `firebase.json` rewrites disagree.
- **Firestore rules deny everything.** Only the Admin SDK touches data.
- **The secret lives in Secret Manager**, because everything in `functions/` ends up
  in the container, `.gitignore` or not.
- **Cost:** function CPU runs out first, not Firestore. Verification costs zero
  reads, and tokens are cached per instance. ~1,200 DAU stores fit in the free tier.

And the traps that cost me real time: `serviceId` is the export name *lowercased*; a
function/rewrite region mismatch deploys fine and serves 404; dropping
`invoker: "public"` gives you a Google 403 that looks exactly like a CORS bug;
Hosting cuts rewritten requests at 60s whatever `timeoutSeconds` says.

Gadget → Firebase guide: https://github.com/mksd0398/nitrogen/blob/main/marketing/gadget-wind-down/migration-guide.md

Feedback from people who run Firebase at scale is very welcome.

---

## r/SaaS or r/indiehackers (founder angle)

**Title:** Gadget's shutdown is a reminder: own the code your business runs on

**Body:**

Gadget, a hosted platform many Shopify app businesses were built on, is shutting
down. Apps keep running until March 31, 2027. After that, anyone who hasn't
migrated loses their product.

Gadget is giving long notice and promising migration tools, which is decent of
them. But it's a good moment to check your own stack: if your platform disappeared,
how much of your product is in your repo, and how much only exists in their
dashboard?

That question is why I built Nitrogen (open source) the way I did: one command
generates a Shopify app where every line, auth and webhook verification included,
is in your repository, running on standard Firebase services. No runtime of mine
sits in the middle, so if I stop maintaining it, your app keeps running.

Not the only answer: Shopify's own template and Cloudflare-based starters have the
same property. The point is to pick something you could keep running without the
vendor.

Migration guide if you're affected: https://github.com/mksd0398/nitrogen/blob/main/marketing/gadget-wind-down/migration-guide.md

---

## Comment template for existing "where do we go from Gadget?" threads

Use only where it answers the question asked. Edit it to fit the thread.

> We're moving Gadget apps to Firebase (Cloud Functions + Firestore), which kept
> the scale-to-zero, no-servers part. The quickest win was listing which Gadget
> features we actually used: auth, webhooks and a few models port quickly, and
> data sync is the real work. Often you can drop it and call the Admin API on
> demand instead.
>
> Disclosure: I maintain Nitrogen, an open-source scaffold for exactly this
> (`npx @mksd0398/nitrogen`). I wrote up a concept map and cutover checklist here:
> https://github.com/mksd0398/nitrogen/blob/main/marketing/gadget-wind-down/migration-guide.md
