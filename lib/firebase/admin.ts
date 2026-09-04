import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function sanitizeString(raw?: string) {
  if (!raw) return undefined;

  let str = raw.trim();
  if (str.endsWith(",")) {
    str = str.slice(0, -1).trim();
  }

  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  return str || undefined;
}

function sanitizePrivateKey(raw?: string) {
  if (!raw) return undefined;
  let key = sanitizeString(raw);
  if (!key) return undefined;
  // Convert escaped newlines and normalize CRLF to LF
  key = key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  return key;
}

const projectId = sanitizeString(process.env.FIREBASE_ADMIN_PROJECT_ID);
const clientEmail = sanitizeString(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);

const privateKey = sanitizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

export const isFirebaseAdminConfigured = Boolean(projectId && clientEmail && privateKey);

export const getAdminDatabase = () => {
  if (!isFirebaseAdminConfigured) {
    return null;
  }

  try {
    const existing = getApps()[0];
    if (existing) {
      return getFirestore(existing);
    }

    // Allow passing a full service account JSON via env var FIREBASE_ADMIN_SERVICE_ACCOUNT
    const rawServiceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
    let serviceAccount: { project_id?: string; client_email?: string; private_key?: string } | undefined;

    if (rawServiceAccount) {
      try {
        // Support base64-encoded JSON or raw JSON
        const maybeJson = rawServiceAccount.trim();
        const decoded = maybeJson.startsWith("ey{") || maybeJson.startsWith("{") ? maybeJson : Buffer.from(maybeJson, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      } catch {
        // Ignore malformed FIREBASE_ADMIN_SERVICE_ACCOUNT and fall back to individual env vars.
      }
    }

    const credentialPayload = serviceAccount
      ? {
          projectId: serviceAccount.project_id || projectId,
          clientEmail: serviceAccount.client_email || clientEmail,
          privateKey: sanitizePrivateKey(serviceAccount.private_key) || privateKey,
        }
      : { projectId, clientEmail, privateKey };

    const app = initializeApp({ credential: cert(credentialPayload) });
    return getFirestore(app);
  } catch (err: any) {
    console.error('Firebase admin initialization error:', err && err.message ? err.message : err);
    return null;
  }
};
