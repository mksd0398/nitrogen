# Outreach emails to teams on Gadget

These go to the companies in `leads.csv`: app developers, agencies and brands that
publicly build on Gadget.

## Before sending anything

Cold email can hurt the project's reputation if it reads as spam, and it is
regulated. Keep to these rules:

- **Send to business addresses only**, the ones a company publishes for contact
  (`hello@`, `support@`, a contact form). Never guessed or scraped personal
  addresses. `leads.csv` only holds public business contacts.
- **Send by hand, a few a day, each one personalised.** The `{{personal_line}}`
  must show you looked at their app. No mail-merge blasts.
- **One follow-up at most.** If there's no reply after that, stop.
- **Say who you are and how to opt out.** The US CAN-SPAM Act requires a real
  sender, a physical postal address and a working opt-out. In the EU and UK
  (GDPR, PECR), B2B email to a generic company address is generally fine on
  "legitimate interest" when it's relevant to their business and easy to refuse.
  Germany and a few other countries are stricter, so prefer their contact forms.
- **Record opt-outs** in the `status` column you add to `leads.csv`, and never
  contact them again.
- **Don't misrepresent Gadget.** Quote only the dates from their announcement, and
  don't run down their product or team.

Placeholders: `{{first_name}}` (only if their own site names the person to
contact; otherwise "Hi {{company}} team"), `{{company}}`, `{{app_name}}`,
`{{personal_line}}`, `{{sender_name}}`, `{{sender_title}}`, `{{postal_address}}`.

---

## 1. App developers (an app on the Shopify App Store)

**Subject:** {{app_name}} after Gadget's shutdown

Hi {{first_name}},

{{personal_line}}

You've probably seen that Gadget is winding down: apps keep running until
March 31, 2027, then the platform goes away. I maintain
[Nitrogen](https://github.com/mksd0398/nitrogen), an open-source (MIT) way to run
Shopify apps on Google Firebase. Like Gadget, it scales to zero and you don't
manage a server. Unlike Gadget, all the code lives in your repository.

The parts that matter for an app like {{app_name}}:

- **Your merchants don't reinstall.** You keep the same Shopify app; it just points
  at a new backend.
- **Auth, webhooks, GDPR handlers and an embedded admin are generated for you** in
  one command, with tests.
- **A migration guide** maps Gadget models, actions and background jobs to their
  Firebase equivalents:
  https://github.com/mksd0398/nitrogen/blob/master/marketing/gadget-wind-down/migration-guide.md

It's free and open source; there's nothing to buy. If you're still deciding where
to move, I'm happy to look at what {{app_name}} uses on Gadget and tell you honestly
whether Nitrogen fits. If it doesn't, I'll say so.

{{sender_name}}
{{sender_title}}, Nitrogen

{{postal_address}}
Not relevant? Reply "no thanks" and I won't write again.

---

## 2. Agencies (build client apps on Gadget)

**Subject:** Moving your clients' Gadget apps before March 2027

Hi {{first_name}},

{{personal_line}}

With Gadget shutting down on March 31, 2027, every client app you built there
needs a new home, and that's likely a migration project per client.

I maintain [Nitrogen](https://github.com/mksd0398/nitrogen), an open-source CLI
that generates Shopify apps on Firebase. For agencies, the useful parts are:

- **The client owns everything.** The code is in their repository and the hosting
  is in their own Google Cloud account, so no platform can switch it off again.
- **A consistent starting point for every client:** auth, webhooks, GDPR, an
  embedded admin, single- or multi-store, and a test suite, from one command.
- **Cheap to run:** zero when idle, and small apps fit in Firebase's free tier.
- **A migration guide** you can reuse per client:
  https://github.com/mksd0398/nitrogen/blob/master/marketing/gadget-wind-down/migration-guide.md

If you'd like, I can join a 20-minute call with your team and walk through one of
your client apps on it. No cost, no catch; it's MIT-licensed.

{{sender_name}}
{{sender_title}}, Nitrogen

{{postal_address}}
Not relevant? Reply "no thanks" and I won't write again.

---

## 3. Brands (a custom app built on Gadget for their own store)

**Subject:** Your store's custom app and Gadget's shutdown

Hi {{first_name}},

{{personal_line}}

Gadget, the platform your custom Shopify app was built on, has announced it is
shutting down. The app keeps working until March 31, 2027, then it stops.

Worth checking with whoever maintains it:

1. Is there a plan and a date to move it, well before March?
2. Will you own the new code and the hosting account?

If it helps, [Nitrogen](https://github.com/mksd0398/nitrogen) is a free,
open-source option your developer can move it to. It runs on Google Firebase
under your own account. Here's the guide they'd follow:
https://github.com/mksd0398/nitrogen/blob/master/marketing/gadget-wind-down/migration-guide.md

{{sender_name}}
{{sender_title}}, Nitrogen

{{postal_address}}
Not relevant? Reply "no thanks" and I won't write again.

---

## Follow-up (once, 7–10 days later, only if no reply)

**Subject:** Re: {{original_subject}}

Hi {{first_name}},

A short nudge in case this got buried. If you've already picked where to move
{{app_name}}, great, and ignore this. If not, the guide is here, and I'm glad to
answer questions:
https://github.com/mksd0398/nitrogen/blob/master/marketing/gadget-wind-down/migration-guide.md

{{sender_name}}

---

## Writing `{{personal_line}}`

One specific sentence that shows you looked, for example:

- "I saw Biscuits Bundles earned the Built for Shopify badge. That's hard to get
  with a cart-transform app."
- "Your store locator went from idea to App Store in nine days. I read the
  case study."

Never use flattery that could apply to anyone. If you can't write one, skip that
lead for now.
