const apiKeys = require("../api-keys");
const { endpoint, HttpError } = require("../http");

// Managing keys is for the admin only: no `apiKey` option here, so a key can
// never mint or revoke another key.
module.exports = endpoint({
  "GET /api/keys": async (ctx) => ({
    keys: await apiKeys.list(ctx.app, ctx.shop),
    scopes: apiKeys.SCOPES,
  }),

  "POST /api/keys": async (ctx) => {
    const name = typeof ctx.body?.name === "string" ? ctx.body.name.trim() : "";
    const scope = ctx.body?.scope || apiKeys.SCOPES[0];
    if (!name || name.length > 100) {
      throw new HttpError(400, "Give the key a name, up to 100 characters");
    }
    if (!apiKeys.SCOPES.includes(scope)) {
      throw new HttpError(400, `Scope must be one of: ${apiKeys.SCOPES.join(", ")}`);
    }

    const created = await apiKeys.create(ctx.app, ctx.shop, {
      name,
      scope,
      createdBy: ctx.userId,
    });
    if (!created) throw new HttpError(409, "Key limit reached. Revoke one first");

    // The only time the raw key is ever shown
    return { key: created };
  },

  "DELETE /api/keys/:id": async (ctx) => {
    if (!/^[a-f0-9]{64}$/.test(ctx.params.id)) throw new HttpError(404, "Not found");
    const revoked = await apiKeys.revoke(ctx.app, ctx.shop, ctx.params.id);
    if (!revoked) throw new HttpError(404, "Not found");
    return { revoked: true };
  },
});
