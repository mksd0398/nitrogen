# create-shopify-firebase-app → Nitrogen

**This package has been renamed to [`@mksd0398/nitrogen`](https://www.npmjs.com/package/@mksd0398/nitrogen).**

```bash
# before
npx create-shopify-firebase-app my-app

# now
npx @mksd0398/nitrogen my-app
```

Everything that made this package work still works — this version is a thin
shim that forwards every flag and prompt to Nitrogen unchanged. It will not
receive further updates, so please switch when convenient.

## Why the rename

The old name described the stack instead of naming the tool, ran to 28
characters, and put "shopify" inside a third-party package name. Nitrogen
follows the element naming of Shopify's own developer products — Hydrogen,
Oxygen — and reads as the inert 78% of the atmosphere that everything else
runs inside, which is what a zero-framework scaffolder is.

It ships scoped because the bare `nitrogen` name on npm belongs to an
unrelated, actively maintained project. Scoping also matches how Shopify
publishes its own packages (`@shopify/polaris`, `@shopify/app-bridge`).

## Nothing changes in your generated project

Projects you already scaffolded are unaffected. There is no migration inside
the app — only the command you scaffold new ones with.

Full documentation: **https://github.com/mksd0398/nitrogen**

---

<sub>Nitrogen is an independent community project. Not affiliated with,
authorised by, or endorsed by Shopify Inc. Shopify, Hydrogen, Oxygen, Polaris
and App Bridge are trademarks of Shopify Inc.</sub>
