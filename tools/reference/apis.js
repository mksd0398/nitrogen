// Every App Bridge API and element, with one working example each.
//
// This is the source of templates/web/apis.html and web/js/pages/apis.js.
// `code` is both what the page shows and what its "Run" button executes, so
// the sample cannot drift from the behaviour. Inside `code`, show(value)
// prints a result on the page. After editing, run: npm run build:reference
//
// Everything here is on the global `shopify` object that App Bridge creates
// inside the Shopify admin. There is nothing to import.
//
// Reference: https://shopify.dev/docs/api/app-home/latest/apis

export const groups = [
  { id: "data", title: "Authentication and data" },
  { id: "ui", title: "Interface and interactions" },
  { id: "elements", title: "App Bridge elements" },
  { id: "device", title: "Device and platform" },
];

export const apis = [
  // ── Authentication and data ───────────────────────────────────────────
  {
    id: "config", group: "data", title: "Config", call: "shopify.config",
    summary: "What App Bridge knows about where it is running: the shop, the locale and your client id.",
    code: `show({
  shop: shopify.config.shop,
  locale: shopify.config.locale,
  apiKey: shopify.config.apiKey,
});`,
  },
  {
    id: "environment", group: "data", title: "Environment", call: "shopify.environment",
    summary: "Whether the app is embedded, on Shopify Mobile, or in Point of Sale. Check it before offering something only one of them supports.",
    code: `const { embedded, mobile, pos } = shopify.environment;
show({ embedded, mobile, pos });`,
  },
  {
    id: "id-token", group: "data", title: "ID token", call: "shopify.idToken()",
    summary: "A short-lived token that proves to your backend who is calling. It lasts about a minute, so ask for one per request and never store it. `apiFetch()` in js/app.js does this for you.",
    code: `const token = await shopify.idToken();

const response = await fetch("/api/status", {
  headers: { Authorization: "Bearer " + token },
});
show(await response.json());`,
  },
  {
    id: "fetch", group: "data", title: "Resource fetching", call: "fetch()",
    summary: "App Bridge adds the ID token to every fetch to your own app, so a plain fetch is already authenticated. It can also call the Admin API straight from the page, with no backend, once direct API access is enabled in shopify.app.toml.",
    code: `// Your own backend: the token is attached for you
const mine = await fetch("/api/status");
show(await mine.json());

// The Admin API, directly. Needs in shopify.app.toml:
//   [access.admin]
//   embedded_app_direct_api_access = true
const admin = await fetch("shopify:admin/api/graphql.json", {
  method: "POST",
  body: JSON.stringify({ query: "{ shop { name } }" }),
});
show(await admin.json());`,
  },
  {
    id: "scopes", group: "data", title: "Scopes", call: "shopify.scopes",
    summary: "The access the shop has granted, and a way to ask for an optional scope only when a feature needs it. Optional scopes are declared in shopify.app.toml.",
    code: `const { granted, required, optional } = await shopify.scopes.query();
show({ granted, required, optional });

// Ask when the merchant reaches the feature that needs it:
//   const result = await shopify.scopes.request(["read_orders"]);
//   result.result === "granted-all" or "declined-all"
//
// Give one back:
//   await shopify.scopes.revoke(["read_orders"]);`,
  },
  {
    id: "user", group: "data", title: "User", call: "shopify.user()",
    summary: "The staff member using the app. Use it to greet them or to log who changed what; decide permissions on the backend, from the verified token.",
    code: `const user = await shopify.user();
show(user);`,
  },
  {
    id: "app", group: "data", title: "App", call: "shopify.app",
    summary: "Which of your app's extensions are active on this shop, such as a theme app block the merchant has yet to add.",
    code: `const extensions = await shopify.app.extensions();
show(extensions);`,
  },

  // ── Interface ─────────────────────────────────────────────────────────
  {
    id: "toast", group: "ui", title: "Toast", call: "shopify.toast",
    summary: "A short message at the bottom of the screen that leaves on its own. Give it an action to offer an undo.",
    code: `shopify.toast.show("Product saved");

shopify.toast.show("Product archived", {
  duration: 5000,
  action: "Undo",
  onAction: () => shopify.toast.show("Restored"),
});

// For a failure
shopify.toast.show("Could not save", { isError: true });`,
  },
  {
    id: "loading", group: "ui", title: "Loading", call: "shopify.loading()",
    summary: "The admin's own loading bar, across the top of the page. Turn it on before a slow request and off when it ends.",
    code: `shopify.loading(true);
await new Promise((resolve) => setTimeout(resolve, 2000));
shopify.loading(false);`,
  },
  {
    id: "modal", group: "ui", title: "Modal", call: "shopify.modal",
    summary: "Opens or closes an s-modal by its id. A button with commandFor does the same without any JavaScript.",
    html: `<s-modal id="api-modal" heading="Opened from JavaScript">
  <s-paragraph>shopify.modal.show("api-modal") opened this.</s-paragraph>
  <s-button slot="primary-action" variant="primary" commandFor="api-modal" command="--hide">Done</s-button>
</s-modal>`,
    code: `await shopify.modal.show("api-modal");

// await shopify.modal.hide("api-modal");
// await shopify.modal.toggle("api-modal");`,
  },
  {
    id: "navigation", group: "ui", title: "Navigation", call: "open()",
    summary: "Relative links move around your app without reloading the admin. A shopify:// link with target=\"_top\" leaves your app for a page of the admin.",
    html: `<s-stack direction="inline" gap="base">
  <s-link href="/settings">A page of this app</s-link>
  <s-link href="shopify://admin/products" target="_top">The admin's products</s-link>
  <s-link href="shopify://admin/orders" target="_top">The admin's orders</s-link>
</s-stack>`,
    code: `// From JavaScript, inside the app
open("/settings", "_self");

// To a page of the admin:
//   open("shopify://admin/products", "_top");`,
  },
  {
    id: "resource-picker", group: "ui", title: "Resource picker", call: "shopify.resourcePicker()",
    summary: "Shopify's own search-and-select dialog for products, variants and collections. It returns what the merchant chose, or nothing if they cancelled.",
    code: `const selected = await shopify.resourcePicker({
  type: "product", // or "variant", "collection"
  multiple: 3,     // true for any number, a number for a limit
  filter: { variants: false, draft: false },
});

show(selected ? selected.map((p) => ({ id: p.id, title: p.title })) : "Cancelled");`,
  },
  {
    id: "picker", group: "ui", title: "Picker", call: "shopify.picker()",
    summary: "The same dialog for your own data: templates, campaigns, anything that is not a Shopify resource.",
    code: `const picker = await shopify.picker({
  heading: "Choose a template",
  multiple: false,
  headers: [{ content: "Template" }, { content: "Uses", type: "number" }],
  items: [
    { id: "welcome", heading: "Welcome email", data: ["12"], badges: [{ content: "Live", tone: "success" }] },
    { id: "restock", heading: "Back in stock", data: ["3"] },
  ],
});

show(await picker.selected);`,
  },
  {
    id: "intents", group: "ui", title: "Intents", call: "shopify.intents",
    summary: "Hands the merchant to the admin's own screen for creating or editing something, then tells you how it ended.",
    code: `const activity = await shopify.intents.invoke("create:shopify/Collection");
const response = await activity.complete;

// response.code is "ok", "closed" or "error"
show(response);

// To edit an existing resource:
//   shopify.intents.invoke("edit:shopify/Product", { value: "gid://shopify/Product/123" });`,
  },
  {
    id: "save-bar", group: "ui", title: "Save bar", call: "data-save-bar",
    summary: "The admin's Save and Discard bar. Add data-save-bar to a form and it appears as soon as a field changes: Save submits the form, Discard resets it. The Settings page uses this.",
    run: false,
    html: `<form data-save-bar onsubmit="event.preventDefault(); shopify.toast.show('Saved');">
  <s-text-field label="Change me to show the save bar" name="demo" value="Hello"></s-text-field>
</form>`,
    code: `<form data-save-bar data-discard-confirmation>
  <s-text-field label="Name" name="name"></s-text-field>
</form>

<script>
  const form = document.querySelector("form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    // save, then the bar goes away
  });
  form.addEventListener("reset", () => {
    // Discard was pressed
  });

  // Before navigating away yourself, let the merchant decide:
  //   await shopify.saveBar.leaveConfirmation();
</script>`,
  },
  {
    id: "reviews", group: "ui", title: "Reviews", call: "shopify.reviews",
    summary: "Asks the merchant to review your app. Shopify limits how often it appears, so call it after something went well, and expect it to decline.",
    code: `const result = await shopify.reviews.request();

// result.success is false with a code such as "already-reviewed"
// or "annual-limit-reached" when Shopify chose not to show it
show(result);`,
  },
  {
    id: "support", group: "ui", title: "Support", call: "shopify.support",
    summary: "Runs your code when the merchant asks for support from the admin, so you can open your own chat or help page.",
    code: `await shopify.support.registerHandler(() => {
  open("https://example.com/help", "_blank");
});
show("Registered. It runs when the merchant asks for support.");`,
  },
  {
    id: "tools", group: "ui", title: "Tools", call: "shopify.tools",
    summary: "Offers functions of your app to the admin's assistant, which can call them on the merchant's behalf while your app is open.",
    code: `shopify.tools.register("get_app_status", async () => {
  const response = await fetch("/api/status");
  return response.json();
});
show("Registered get_app_status");

// shopify.tools.unregister("get_app_status");
// shopify.tools.clear();`,
  },

  // ── Elements ──────────────────────────────────────────────────────────
  {
    id: "app-nav", group: "elements", title: "App nav", call: "<s-app-nav>",
    summary: "Your app's links in the admin sidebar. The link with rel=\"home\" sets the landing page and is left out of the menu. It is at the top of every page in web/.",
    run: false,
    code: `<s-app-nav>
  <s-link href="/" rel="home">Dashboard</s-link>
  <s-link href="/products">Products</s-link>
  <s-link href="/settings">Settings</s-link>
</s-app-nav>`,
  },
  {
    id: "title-bar", group: "elements", title: "Title bar", call: "<s-page>",
    summary: "The page title, breadcrumb and actions in the admin's own title bar. They are slots of s-page.",
    run: false,
    code: `<s-page heading="Edit product">
  <s-link slot="breadcrumb-actions" href="/products">Products</s-link>
  <s-badge slot="accessory" tone="warning">Draft</s-badge>
  <s-button slot="primary-action" variant="primary">Save</s-button>
  <s-button slot="secondary-actions">Duplicate</s-button>
  <s-button slot="secondary-actions" commandFor="more-actions">More actions</s-button>

  <s-menu id="more-actions">
    <s-button icon="view">Preview</s-button>
    <s-button icon="delete" tone="critical">Delete</s-button>
  </s-menu>
</s-page>`,
  },
  {
    id: "app-window", group: "elements", title: "App window", call: "<s-app-window>",
    summary: "A full-screen window showing another page of your app, for an editor that needs the whole screen.",
    html: `<s-app-window id="api-app-window" src="/settings"></s-app-window>
<s-button commandFor="api-app-window" command="--show">Open settings full screen</s-button>`,
    run: false,
    code: `<s-app-window id="editor" src="/settings"></s-app-window>

<s-button commandFor="editor" command="--show">Open</s-button>

<!-- From JavaScript -->
<script>
  document.getElementById("editor").show();
</script>`,
  },

  // ── Device ────────────────────────────────────────────────────────────
  {
    id: "print", group: "device", title: "Print", call: "print()",
    summary: "Opens the print dialog for the current page. On Shopify Mobile it uses the device's printing.",
    code: `print();`,
  },
  {
    id: "share", group: "device", title: "Share", call: "navigator.share()",
    summary: "The device's share sheet, on Shopify Mobile.",
    code: `try {
  await navigator.share({
    text: "Have a look at this",
    url: "https://" + shopify.config.shop,
  });
  show("Shared");
} catch (error) {
  show("Not shared: " + error.message);
}`,
  },
  {
    id: "scanner", group: "device", title: "Scanner", call: "shopify.scanner",
    summary: "Reads a barcode or QR code with the camera. Shopify Mobile and Point of Sale only.",
    code: `if (!shopify.environment.mobile && !shopify.environment.pos) {
  show("The scanner needs Shopify Mobile or Point of Sale");
  return;
}

const { data } = await shopify.scanner.capture();
show(data);`,
  },
  {
    id: "pos", group: "device", title: "POS", call: "shopify.pos",
    summary: "The cart, the device and the location, when the app is open in Shopify Point of Sale.",
    code: `if (!shopify.environment.pos) {
  show("Open the app in Shopify Point of Sale to use this");
  return;
}

show(await shopify.pos.device());

// await shopify.pos.cart.addLineItem(40202439393345, 1);
// await shopify.pos.cart.applyCartDiscount("FixedAmount", "Staff discount", "10");
// await shopify.pos.cart.clear();
// await shopify.pos.close();`,
  },
  {
    id: "web-vitals", group: "device", title: "Web Vitals", call: "shopify.webVitals",
    summary: "The loading and responsiveness measurements Shopify takes of your app, so you can watch them yourself.",
    code: `await shopify.webVitals.onReport((report) => {
  // Send report.metrics wherever you keep measurements
  console.log(report.metrics);
});
show("Registered. Reports arrive as the page is measured.");`,
  },
];
