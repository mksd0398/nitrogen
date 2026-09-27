import { tenantId } from "../config";
import { db } from "../firebase";
import { Context, endpoint, HttpError } from "../http";

// Default app settings — returned when no settings are saved yet.
// This is also the schema: a saved value must have its default's type.
const DEFAULT_SETTINGS = {
  greeting: "Welcome to our app!",
  theme: "auto",
  notifications: true,
  orderAlerts: false,
  customCss: "",
};

const MAX_STRING_LENGTH = 10000;

function settingsRef(ctx: Context) {
  return db.collection("appSettings").doc(tenantId(ctx.app, ctx.shop));
}

async function read(ctx: Context) {
  const doc = await settingsRef(ctx).get();
  // Merge with defaults so new keys are always present
  return { settings: { ...DEFAULT_SETTINGS, ...doc.data() } };
}

export default endpoint({
  "GET /api/settings": read,

  "POST /api/settings": async (ctx) => {
    const body = ctx.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "Request body must be a JSON object");
    }

    // Only known keys, only values of the right type
    const settings: Record<string, unknown> = {};
    for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(key in body)) continue;
      const value = body[key];
      if (typeof value !== typeof fallback) {
        throw new HttpError(400, `"${key}" must be a ${typeof fallback}`);
      }
      if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
        throw new HttpError(400, `"${key}" is too long`);
      }
      settings[key] = value;
    }

    if (Object.keys(settings).length === 0) {
      throw new HttpError(400, "No valid settings provided");
    }

    await settingsRef(ctx).set(settings, { merge: true });
    return read(ctx);
  },
});
