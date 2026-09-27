import { endpoint } from "./http";

// Storefront-facing routes, reached through the Shopify App Proxy at
//   https://your-store.myshopify.com/apps/{subpath}/hello
// `auth: "proxy"` verifies Shopify's signature on every request, so a route
// here only ever runs for a genuine storefront call. ctx.shop and ctx.app
// come from that signature, never from anything the shopper can set.
// Docs: https://shopify.dev/docs/apps/build/online-store/app-proxies
export default endpoint(
  {
    "GET /proxy/hello": async (ctx) => ({
      message: `Hello from the app proxy! Shop: ${ctx.shop}`,
    }),
  },
  { auth: "proxy" },
);

// ──────────────────────────────────────────────────────────────────────────
// HOW TO ADD A NEW PROXY ROUTE:
//
//   "GET /proxy/my-route": async (ctx) => ({ hello: "storefront" }),
//
// Enable App Proxy in shopify.app.toml (uncomment the [app_proxy] section).
// Deploy: firebase deploy --only functions:proxy
// ──────────────────────────────────────────────────────────────────────────
