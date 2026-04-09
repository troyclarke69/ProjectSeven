import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isGeminiConfigured } from "@/lib/gemini";

const hasPublicFirebaseConfig = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
);

export async function GET() {
  return NextResponse.json({
    firebaseAdminReady: isFirebaseAdminConfigured,
    firebaseClientReady: hasPublicFirebaseConfig,
    geminiReady: isGeminiConfigured,
    githubWebhookSecretReady: Boolean(process.env.GITHUB_WEBHOOK_SECRET),
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    requiredEnv: {
      firebaseAdmin: [
        "FIREBASE_ADMIN_PROJECT_ID",
        "FIREBASE_ADMIN_CLIENT_EMAIL",
        "FIREBASE_ADMIN_PRIVATE_KEY",
      ],
      firebaseClient: [
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID",
      ],
      gemini: ["GEMINI_API_KEY", "GEMINI_MODEL"],
      githubWebhook: ["GITHUB_WEBHOOK_SECRET"],
    },
  });
}
