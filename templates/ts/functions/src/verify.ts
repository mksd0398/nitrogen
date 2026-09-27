// Every check that decides whether a request really came from Shopify.
//
// Two rules hold for all of them:
//   1. Fail closed. A missing signature, header or body means NO.
//   2. The app is never read from the caller. Each verifier tries every
//      configured app's secret, and the app that verifies IS the tenant.

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { apps, ShopifyApp } from "./config";

type Query = Record<string, unknown>;

// App Bridge session token payload
// Docs: https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
export interface SessionTokenPayload {
  iss: string; // https://{shop}.myshopify.com/admin
  dest: string; // https://{shop}.myshopify.com
  aud: string; // Client id
  sub: string; // User id
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
}

export interface VerifiedSession {
  app: ShopifyApp;
  shop: string;
  payload: SessionTokenPayload;
}

// Shop domains are always <handle>.myshopify.com. The value ends up in
// redirects, outbound URLs and Firestore document ids.
const SHOP_DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export function isValidShopDomain(shop: unknown): shop is string {
  return typeof shop === "string" && SHOP_DOMAIN_PATTERN.test(shop);
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function hmac(secret: string, message: string | Buffer, encoding: "base64" | "hex"): string {
  return crypto.createHmac("sha256", secret).update(message).digest(encoding);
}

/** The app whose secret produces `given`, or null. */
function appThatSigned(given: unknown, sign: (secret: string) => string): ShopifyApp | null {
  if (typeof given !== "string" || !given) return null;
  return apps().find((app) => safeEqual(sign(app.secret), given)) || null;
}

// Shopify signs the sorted query string, minus the signature itself. A
// repeated parameter arrives as an array and is signed comma-joined.
function queryMessage(query: Query, omit: string[], separator: string): string {
  return Object.keys(query)
    .filter((key) => !omit.includes(key))
    .sort()
    .map((key) => `${key}=${([] as unknown[]).concat(query[key]).join(",")}`)
    .join(separator);
}

// ─── Webhooks ────────────────────────────────────────────────────────────
// Docs: https://shopify.dev/docs/apps/build/webhooks/subscribe/https
export function verifyWebhook(rawBody: Buffer | undefined, hmacHeader: unknown): ShopifyApp | null {
  if (!rawBody) return null;
  return appThatSigned(hmacHeader, (secret) => hmac(secret, rawBody, "base64"));
}

// ─── App Proxy ───────────────────────────────────────────────────────────
// Docs: https://shopify.dev/docs/apps/build/online-store/app-proxies
export function verifyProxy(query: Query): ShopifyApp | null {
  // App proxy concatenates without & (different from OAuth)
  const message = queryMessage(query, ["signature"], "");
  return appThatSigned(query.signature, (secret) => hmac(secret, message, "hex"));
}

// ─── OAuth callback ──────────────────────────────────────────────────────
export function verifyOAuth(query: Query): ShopifyApp | null {
  const message = queryMessage(query, ["hmac", "signature"], "&");
  return appThatSigned(query.hmac, (secret) => hmac(secret, message, "hex"));
}

// ─── Session token (embedded admin) ──────────────────────────────────────
// `aud` is read unverified only to choose which secret to try. Verifying with
// that app's secret AND its audience makes the choice part of what the
// signature covers, so a token cannot pick an app it was not issued for.
export function verifySessionToken(token: string): VerifiedSession | null {
  try {
    const claimed = jwt.decode(token);
    const app =
      claimed && typeof claimed === "object"
        ? apps().find((a) => a.clientId === claimed.aud)
        : undefined;
    if (!app) return null;

    const payload = jwt.verify(token, app.secret, {
      algorithms: ["HS256"],
      audience: app.clientId,
      // A token lives about 60 seconds and App Bridge hands out the one it
      // holds until nearly spent, so one minted late arrives expired.
      clockTolerance: 10,
    }) as SessionTokenPayload;

    const shop = new URL(payload.iss).hostname;
    if (!isValidShopDomain(shop)) return null;
    if (payload.dest && new URL(payload.dest).hostname !== shop) return null;

    return { app, shop, payload };
  } catch {
    return null;
  }
}
