import crypto from "crypto";
import type { Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import type { Request } from "firebase-functions/v2/https";
import { apps, getConfig, ShopifyApp, tenantId } from "./config";
import { db } from "./firebase";
import { HttpError } from "./http";
import { isValidShopDomain, verifyOAuth } from "./verify";

// OAuth state nonces are single-use and short-lived.
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// The state nonce is 16 random bytes hex-encoded (see handleStart).
const NONCE_PATTERN = /^[a-f0-9]{32}$/;

interface Session {
  accessToken: string;
  scope: string;
  expiresAt: string | null;
  isOnline: boolean;
  source: "oauth" | "token-exchange";
}

/**
 * Standalone OAuth handler — no routing table, two fixed paths.
 *
 * Routes:
 *   GET /auth           → Start OAuth (redirect to Shopify consent screen)
 *   GET /auth/callback  → Handle callback (exchange code, store session)
 */
export async function authHandler(req: Request, res: Response): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    if (req.path === "/auth/callback") await handleCallback(req, res);
    else await handleStart(req, res);
  } catch (err) {
    console.error("OAuth error:", err);
    res.status(500).send("OAuth error");
  }
}

// ─── Step 1: Start OAuth ─────────────────────────────────────────────────
// Merchant clicks "Install" → redirect to Shopify consent screen.
async function handleStart(req: Request, res: Response): Promise<void> {
  const { shop } = req.query;
  if (!isValidShopDomain(shop)) {
    res.status(400).send("Invalid shop parameter");
    return;
  }

  // Which app to install is the one thing a caller may choose: the client id
  // in an install link is public. The callback then proves it (see below).
  const configured = apps();
  const app = req.query.app
    ? configured.find((a) => a.key === req.query.app)
    : configured[0];
  if (!app) {
    res.status(400).send("Unknown app");
    return;
  }

  const nonce = crypto.randomBytes(16).toString("hex");

  // Store nonce for CSRF protection. Must be awaited — Cloud Functions may
  // freeze the instance once the response is sent, dropping in-flight writes.
  // expiresAt is a Timestamp so a Firestore TTL policy on this collection
  // purges stale nonces automatically.
  await db.collection("authNonces").doc(nonce).set({
    shop,
    app: app.key,
    createdAt: new Date().toISOString(),
    expiresAt: Timestamp.fromMillis(Date.now() + NONCE_TTL_MS),
  });

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(app.clientId)}` +
    `&scope=${encodeURIComponent(getConfig().scopes)}` +
    `&redirect_uri=${encodeURIComponent(`${app.appUrl}/auth/callback`)}` +
    `&state=${nonce}`;

  res.redirect(authUrl);
}

// ─── Step 2: OAuth Callback ──────────────────────────────────────────────
// Shopify redirects back with code + HMAC. Verify, exchange, store session.
async function handleCallback(req: Request, res: Response): Promise<void> {
  const { shop, code, state } = req.query;

  if (!isValidShopDomain(shop)) {
    res.status(400).send("Invalid shop parameter");
    return;
  }
  if (typeof code !== "string" || !code) {
    res.status(400).send("Missing required parameters");
    return;
  }

  // The app is whichever one's secret signed this callback
  const app = verifyOAuth(req.query);
  if (!app) {
    res.status(403).send("HMAC verification failed");
    return;
  }

  // A callback we did not start has no matching nonce, so an absent or
  // unknown state must be rejected — not merely skipped.
  if (typeof state !== "string" || !NONCE_PATTERN.test(state)) {
    res.status(403).send("Missing or malformed state parameter");
    return;
  }

  const nonceRef = db.collection("authNonces").doc(state);
  const nonceDoc = await nonceRef.get();
  if (!nonceDoc.exists) {
    res.status(403).send("Invalid state parameter");
    return;
  }

  // Burn the nonce before validating it so it can never be replayed,
  // whatever the outcome below.
  await nonceRef.delete();

  // The nonce must be fresh AND belong to this shop and this app, otherwise
  // a nonce issued for one tenant could authorize another.
  const nonce = nonceDoc.data() ?? {};
  const expiresAt = nonce.expiresAt as Timestamp | undefined;
  if (!expiresAt || expiresAt.toMillis() < Date.now()) {
    res.status(403).send("Expired state parameter");
    return;
  }
  if (nonce.shop !== shop || nonce.app !== app.key) {
    res.status(403).send("State parameter does not match");
    return;
  }

  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: app.clientId,
      client_secret: app.secret,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    console.error("Token exchange failed:", await tokenResponse.text());
    res.status(500).send("Token exchange failed");
    return;
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    scope: string;
    // Present only for online (per-user) tokens, which expire
    expires_in?: number;
    associated_user?: unknown;
  };

  // Offline tokens (shpat_) do not expire; online ones (expires_in set) do.
  // Record the expiry so a stale token is replaced rather than producing
  // confusing 401s from the Admin API.
  const tokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  if (tokenExpiresAt) {
    console.warn(
      `Received an online access token for ${shop} (expires ${tokenExpiresAt}). ` +
        "Offline tokens are expected for background work.",
    );
  }

  await saveSession(app, shop, {
    accessToken: tokenData.access_token,
    scope: tokenData.scope,
    expiresAt: tokenExpiresAt,
    isOnline: !!tokenData.associated_user,
    source: "oauth",
  });

  console.log(`App installed for shop: ${shop}`);
  res.redirect(`https://${shop}/admin/apps/${app.clientId}`);
}

// ─── Sessions ────────────────────────────────────────────────────────────
// One document per tenant (a shop under one app) — see tenantId().
function sessionRef(app: ShopifyApp, shop: string) {
  return db.collection("shopSessions").doc(tenantId(app, shop));
}

function saveSession(app: ShopifyApp, shop: string, session: Session) {
  return sessionRef(app, shop).set({
    shop,
    app: app.key,
    clientId: app.clientId,
    installedAt: new Date().toISOString(),
    ...session,
  });
}

export function deleteSession(app: ShopifyApp, shop: string) {
  tokens.delete(tenantId(app, shop));
  return sessionRef(app, shop).delete();
}

// Access tokens held in the instance, so a busy tenant costs one Firestore
// read every few minutes instead of one per request. A revoked token is
// dropped by deleteSession() the moment Shopify refuses it.
const TOKEN_CACHE_MS = 5 * 60 * 1000;
const tokens = new Map<string, { accessToken: string; until: number }>();

function remember(app: ShopifyApp, shop: string, accessToken: string): string {
  tokens.set(tenantId(app, shop), { accessToken, until: Date.now() + TOKEN_CACHE_MS });
  return accessToken;
}

// ─── Token exchange ──────────────────────────────────────────────────────
// Apps built with the Shopify CLI use managed installation by default:
// Shopify installs the app and grants scopes WITHOUT calling /auth, so the
// authorization-code routes above never run for a normal install. The
// embedded app is simply loaded with an ID token, and this is how that ID
// token becomes an Admin API access token.
// Docs: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens

/**
 * A 401 App Bridge answers by fetching a fresh ID token and retrying.
 * Routine, not a fault: an ID token lives about a minute.
 */
export function staleToken(): HttpError {
  return new HttpError(401, "Stale ID token", {
    "X-Shopify-Retry-Invalid-Session-Request": "1",
  });
}

async function exchangeIdToken(app: ShopifyApp, shop: string, idToken: string): Promise<string> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: app.clientId,
      client_secret: app.secret,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type:
        "urn:shopify:params:oauth:token-type:offline-access-token",
    }),
  });

  if (response.status === 400) throw staleToken();

  if (!response.ok) {
    throw new Error(
      `Token exchange failed (${response.status}): ${await response.text()}`,
    );
  }

  const data = (await response.json()) as { access_token?: string; scope: string };
  if (!data.access_token) throw new Error("Token exchange returned no token");

  await saveSession(app, shop, {
    accessToken: data.access_token,
    scope: data.scope,
    expiresAt: null,
    isOnline: false,
    source: "token-exchange",
  });

  console.log(`Access token obtained via token exchange for ${shop}`);
  return remember(app, shop, data.access_token);
}

/**
 * Get an access token for a tenant. Reads the stored one; falls back to token
 * exchange when an ID token is supplied, which is the path a managed install
 * takes. Returns null when there is neither.
 */
export async function getAccessToken(
  app: ShopifyApp,
  shop: string,
  idToken?: string,
): Promise<string | null> {
  const cached = tokens.get(tenantId(app, shop));
  if (cached && cached.until > Date.now()) return cached.accessToken;

  const data = (await sessionRef(app, shop).get()).data();

  // An expired online token is worse than no token: it produces 401s from
  // Shopify rather than a clean signal.
  const expired =
    data?.expiresAt && new Date(data.expiresAt).getTime() <= Date.now();

  // Only offline tokens are cached: an online one can expire mid-cache
  if (data?.accessToken && !expired) {
    return data.expiresAt ? data.accessToken : remember(app, shop, data.accessToken);
  }
  return idToken ? await exchangeIdToken(app, shop, idToken) : null;
}
