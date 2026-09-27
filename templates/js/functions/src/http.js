// endpoint() — turns a table of routes into one Cloud Function handler.
//
// It does the parts every API needs so a route is only its own logic:
// authentication, rate limiting, routing, JSON in and out, error handling.
//
//   module.exports = endpoint({
//     "GET /api/things":      async (ctx) => ({ things: [] }),
//     "GET /api/things/:id":  async (ctx) => ({ id: ctx.params.id }),
//     "POST /api/things":     async (ctx) => ({ saved: ctx.body }),
//   });
//
// A route returns the JSON to send, or throws HttpError for anything else.
// ctx: { app, shop, userId, apiKey, params, query, body, token, req, res }
//
// Options:
//   auth       "session" (default) — the embedded admin's session token
//              "proxy"             — a storefront App Proxy signature
//   apiKey     "scope"  — ALSO accept an API key carrying this scope, for
//              callers outside Shopify. Opt in per function; off by default.
//   rateLimit  { max, windowSeconds } or false — see RATE_LIMITS below

const apiKeys = require("./api-keys");
const { tenantId } = require("./config");
const { verifySessionToken, verifyProxy, isValidShopDomain } = require("./verify");

class HttpError extends Error {
  /** @param {number} status @param {string} message @param {object} [headers] */
  constructor(status, message, headers) {
    super(message);
    this.status = status;
    this.headers = headers || {};
  }
}

// ─── Who is calling ──────────────────────────────────────────────────────
async function authenticate(req, options) {
  // Storefront: Shopify signs the query string of every App Proxy request
  if (options.auth === "proxy") {
    const app = verifyProxy(req.query);
    if (!app || !isValidShopDomain(req.query.shop)) {
      throw new HttpError(403, "Invalid signature");
    }
    return { kind: "proxy", app, shop: req.query.shop, token: "" };
  }

  // Embedded admin: Authorization: Bearer <App Bridge session token>
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = bearer && verifySessionToken(bearer);
  if (session) {
    return {
      kind: "session",
      app: session.app,
      shop: session.shop,
      userId: session.payload.sub || null,
      token: bearer,
    };
  }

  // Outside systems: X-API-Key, or Bearer because that is what most HTTP
  // clients reach for. Only on functions that opted in.
  if (options.apiKey) {
    const key = await apiKeys.verify(req.headers["x-api-key"] || bearer, options.apiKey);
    if (key) {
      return { kind: "apiKey", app: key.app, shop: key.shop, apiKey: key, token: "" };
    }
  }

  throw new HttpError(401, options.apiKey ? "Invalid credentials" : "Invalid session token");
}

// ─── Rate limiting ───────────────────────────────────────────────────────
// Requests per caller per window. A session caller is a tenant, an API-key
// caller is that key. Storefront traffic is not limited here: every shopper
// of a store arrives as the same tenant from Shopify's own addresses, so
// there is nothing fair to count by.
//
// ponytail: counted in memory, per instance, so with maxInstances N the real
// ceiling is N x max. That is enough to stop a runaway loop or a leaked key.
// Count in a shared store (Firestore, Redis) if you need a hard global limit.
const RATE_LIMITS = {
  session: { max: 300, windowSeconds: 60 },
  apiKey: { max: 60, windowSeconds: 60 },
  proxy: false,
};

/** Seconds until the caller may retry, or 0 when the request is allowed. */
function limited(windows, key, { max, windowSeconds }, now = Date.now()) {
  if (windows.size > 5000) {
    for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k);
  }
  let window = windows.get(key);
  if (!window || now >= window.resetAt) {
    window = { count: 0, resetAt: now + windowSeconds * 1000 };
    windows.set(key, window);
  }
  window.count += 1;
  return window.count > max ? Math.ceil((window.resetAt - now) / 1000) : 0;
}

// ─── Routing ─────────────────────────────────────────────────────────────
function segments(path) {
  return path.split("/").filter(Boolean);
}

function compile(routes) {
  return Object.entries(routes)
    .map(([key, handler]) => {
      const [method, path] = key.trim().split(/\s+/);
      const parts = segments(path);
      return { method, parts, handler, params: parts.filter((p) => p[0] === ":").length };
    })
    // Exact paths win over parameters, so "/products/search" is never
    // swallowed by "/products/:id" whatever order they were written in.
    .sort((a, b) => a.params - b.params);
}

function match(route, path) {
  const given = segments(path);
  if (given.length !== route.parts.length) return null;
  const params = {};
  try {
    for (let i = 0; i < given.length; i++) {
      const part = route.parts[i];
      if (part[0] === ":") params[part.slice(1)] = decodeURIComponent(given[i]);
      else if (part !== given[i]) return null;
    }
  } catch {
    return null; // malformed percent-encoding matches nothing
  }
  return params;
}

/**
 * @param {Record<string, (ctx: object) => any>} routes  "METHOD /path" -> handler
 * @param {{ auth?: "session" | "proxy", apiKey?: string,
 *           rateLimit?: { max: number, windowSeconds: number } | false }} [options]
 */
function endpoint(routes, options = {}) {
  const table = compile(routes);
  const windows = new Map();

  return async (req, res) => {
    try {
      const { kind, ...caller } = await authenticate(req, options);

      const limit = options.rateLimit ?? RATE_LIMITS[kind];
      if (limit) {
        const who = caller.apiKey ? `key:${caller.apiKey.id}` : tenantId(caller.app, caller.shop);
        const retryAfter = limited(windows, who, limit);
        if (retryAfter) {
          throw new HttpError(429, "Too many requests", { "Retry-After": String(retryAfter) });
        }
      }

      const onPath = table
        .map((route) => ({ route, params: match(route, req.path) }))
        .filter((m) => m.params);
      if (onPath.length === 0) throw new HttpError(404, "Not found");

      const hit = onPath.find((m) => m.route.method === req.method);
      if (!hit) {
        const allow = onPath.map((m) => m.route.method).join(", ");
        throw new HttpError(405, "Method not allowed", { Allow: allow });
      }

      const result = await hit.route.handler({
        userId: null,
        apiKey: null,
        ...caller,
        params: hit.params,
        query: req.query,
        body: req.body,
        req,
        res,
      });
      if (!res.headersSent) res.status(200).json(result ?? {});
    } catch (err) {
      if (res.headersSent) return;
      if (err instanceof HttpError) {
        res.set(err.headers).status(err.status).json({ error: err.message });
        return;
      }
      // Internal messages stay in the logs, never in the response
      console.error(`${req.method} ${req.path} failed:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

module.exports = { endpoint, HttpError, limited };
