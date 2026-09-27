import { endpoint } from "../http";
import { API_VERSION } from "../shopify";

// The one route open to API keys, as a worked example: it answers the
// embedded admin AND any outside system holding a key with the "read" scope.
//
//   curl https://your-project.web.app/api/status -H "X-API-Key: key_live_..."
//
// ctx.shop and ctx.app are the tenant that created the key.
export default endpoint(
  {
    "GET /api/status": async (ctx) => ({
      ok: true,
      shop: ctx.shop,
      app: ctx.app.key,
      apiVersion: API_VERSION,
      caller: ctx.apiKey ? `key:${ctx.apiKey.name}` : "admin",
    }),
  },
  { apiKey: "read" },
);
