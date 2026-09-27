const { getAccessToken, deleteSession, staleToken } = require("./auth");
const { HttpError } = require("./http");

// Shopify API version — update when Shopify releases new versions
// (quarterly: January, April, July, October)
// Docs: https://shopify.dev/docs/api/usage/versioning
const API_VERSION = "2026-07";

/**
 * Run an Admin API GraphQL query as the calling tenant and return `data`.
 *
 *   const data = await graphql(ctx, `{ shop { name } }`);
 *   const data = await graphql(ctx, `query ($id: ID!) { ... }`, { id });
 */
async function graphql(ctx, query, variables) {
  const accessToken = await getAccessToken(ctx.app, ctx.shop, ctx.token);
  if (!accessToken) throw new HttpError(401, "Shop not authenticated");

  const response = await fetch(
    `https://${ctx.shop}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  // Shopify announces a deprecation on the response of the very call that
  // uses the deprecated field, and nowhere else this app can see.
  const deprecated = response.headers?.get?.("x-shopify-api-deprecated-reason");
  if (deprecated) console.warn(`Shopify deprecation (${API_VERSION}): ${deprecated}`);

  // Shopify's own rate limit. Pass it on so the caller backs off.
  if (response.status === 429) {
    const retryAfter = response.headers?.get?.("retry-after") || "2";
    throw new HttpError(429, "Shopify is rate limiting this shop", { "Retry-After": retryAfter });
  }

  // The stored token was revoked (the app was reinstalled, say). Drop it and
  // have the client retry: the next call obtains a new one by token exchange.
  if (response.status === 401) {
    await deleteSession(ctx.app, ctx.shop);
    throw staleToken();
  }

  const data = await response.json().catch(() => ({}));

  // GraphQL reports the same limit as a 200 with a THROTTLED error
  if (data.errors?.some((e) => e.extensions?.code === "THROTTLED")) {
    throw new HttpError(429, "Shopify is rate limiting this shop", { "Retry-After": "2" });
  }

  // A GraphQL error still comes back as HTTP 200 with data: null. Without
  // this check a route answers 200 with nothing in it and the UI silently
  // renders blanks.
  if (!response.ok || data.errors) {
    console.error("Admin API error:", JSON.stringify(data.errors ?? data));
    throw new HttpError(502, data.errors?.[0]?.message || "Shopify Admin API error");
  }

  return data.data;
}

module.exports = { graphql, API_VERSION };
