import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js config: no providers, no Postgres/bcrypt imports.
// Middleware runs on Netlify/Vercel Edge Functions, which can't reliably
// bundle Node-only packages like `pg` or native crypto. This config only
// decodes/verifies the session JWT, so it's safe there. The full config
// (Credentials provider, database lookups, password hashing) lives in
// lib/auth.ts and is only used by Node-runtime API routes.
export const authConfig: NextAuthConfig = {
  // Netlify (like most non-Vercel hosts) isn't auto-trusted by Auth.js, so
  // without this every sign-in attempt fails with an UntrustedHost error
  // (surfaces to the client as a 500 on the credentials callback).
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};
