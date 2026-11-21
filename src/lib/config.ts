const isProd = process.env.NODE_ENV === "production";

function need(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (!isProd) return devDefault;
  throw new Error(`Missing required environment variable ${name}`);
}

export const adminPassword = () => need("ADMIN_PASSWORD", "dev-password-change-me");
export const sessionSecret = () => need("SESSION_SECRET", "dev-only-secret-change-me");
export const adminName = () => process.env.ADMIN_NAME || "The Joie TV";

/** `npm run sandbox` sets this: ignore Google entirely and use local files, so it can't touch live data. */
const forceLocal = () => process.env.JTV_LOCAL === "1";

/** Videos live in Google Drive once an OAuth refresh token is configured; otherwise in ./.data/videos. */
export const storageMode = (): "drive" | "local" =>
  !forceLocal() && process.env.GOOGLE_OAUTH_REFRESH_TOKEN ? "drive" : "local";

/** Data lives in Firestore once a service account is configured; otherwise in ./.data/db.json. */
export const dbMode = (): "firestore" | "local" =>
  !forceLocal() && process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? "firestore" : "local";
