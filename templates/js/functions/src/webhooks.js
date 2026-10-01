const { deleteSession } = require("./auth");
const { tenantId } = require("./config");
const { db } = require("./firebase");
const { API_VERSION } = require("./shopify");
const { isAllowedShop, verifyWebhook } = require("./verify");

// Every collection that holds a tenant's data. shop/redact deletes it all, so
// add each collection you create to one of these lists.
const TENANT_DOCS = ["shopSessions", "appSettings"]; // the document id is the tenant id
const TENANT_FIELD = ["apiKeys"]; // each document has a `tenant` field

/**
 * Standalone webhook handler.
 *
 * Webhooks must respond 200 within 5 seconds. Uses req.rawBody (provided
 * natively by Firebase v2) for HMAC verification: the signature covers the
 * exact bytes Shopify sent, not a re-serialized body.
 */
async function webhookHandler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const topic = req.headers["x-shopify-topic"];
  const shop = req.headers["x-shopify-shop-domain"];

  // A missing header or body means NO. The app that signed the webhook is
  // the tenant, so one app's webhook can never touch another app's data.
  const app = verifyWebhook(req.rawBody, req.headers["x-shopify-hmac-sha256"]);
  if (!app || !isAllowedShop(shop)) {
    // Usually another app, or a rotated secret, still pointed at this URL
    console.error(`Webhook refused: bad signature (${topic} from ${shop})`);
    res.status(401).send("Unauthorized");
    return;
  }

  console.log(`Webhook: ${topic} from ${shop}`);

  // Payloads arrive in the api_version of shopify.app.toml. When that version
  // is retired Shopify silently moves them to a newer schema, and this header
  // is the only symptom.
  const version = req.headers["x-shopify-api-version"];
  if (version && version !== API_VERSION) {
    console.warn(`Webhooks arrive as ${version}, but the app is built for ${API_VERSION}`);
  }

  let body = {};
  try {
    body = JSON.parse(req.rawBody.toString("utf8") || "{}");
  } catch {
    // Non-JSON webhook payloads are rare but valid
  }

  switch (topic) {
    // ── App lifecycle ──────────────────────────────────────────────────
    case "app/uninstalled": {
      await deleteSession(app, shop);
      console.log(`Session cleaned up for ${shop}`);
      break;
    }

    // ── GDPR mandatory webhooks (required for App Store) ───────────────
    case "customers/data_request": {
      // Customer requested their data. Export within 30 days if you store any.
      console.log(`Customer data request: ${shop}`);
      // TODO: implement if you store customer data
      break;
    }

    case "customers/redact": {
      // Customer requested deletion. Delete within 30 days.
      console.log(`Customer redact: ${shop}`);
      // TODO: implement if you store customer data
      break;
    }

    case "shop/redact": {
      // 48h after uninstall. Delete ALL of this tenant's data: every
      // collection in TENANT_DOCS and TENANT_FIELD.
      // ponytail: one delete per document. A collection with thousands of
      // documents per shop wants db.bulkWriter(); Shopify retries a slow reply.
      const id = tenantId(app, shop);
      const owned = await Promise.all(
        TENANT_FIELD.map((name) => db.collection(name).where("tenant", "==", id).get()),
      );
      await Promise.all([
        ...TENANT_DOCS.map((name) => db.collection(name).doc(id).delete()),
        ...owned.flatMap((snapshot) => snapshot.docs.map((doc) => doc.ref.delete())),
      ]);
      console.log(`Shop redacted: ${shop}`);
      break;
    }

    default:
      console.log(`Unhandled webhook: ${topic}`, Object.keys(body));
  }

  // Always respond 200 quickly — do heavy work asynchronously
  res.status(200).send("OK");
}

// ──────────────────────────────────────────────────────────────────────────
// HOW TO ADD A NEW WEBHOOK HANDLER:
//
//   1. Register the topic in shopify.app.toml:
//      [[webhooks.subscriptions]]
//      topics = [ "orders/create" ]
//      uri = "https://YOUR-PROJECT.web.app/webhooks"   (the same uri as the others)
//
//   2. Add a case to the switch above:
//      case "orders/create": {
//        const order = body;
//        // Your logic here
//        break;
//      }
//
//   3. Deploy the handler, then register the topic with Shopify:
//      firebase deploy --only functions:webhooks
//      shopify app deploy
// ──────────────────────────────────────────────────────────────────────────

module.exports = { webhookHandler };
