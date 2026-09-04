import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Uses the edge-safe config (no Credentials provider, no Postgres/bcrypt
// imports) so this can run as a standard Edge Function on Netlify/Vercel.
// It only verifies the session JWT -- actual credential checking happens
// in lib/auth.ts, used only by Node-runtime API routes.
const { auth } = NextAuth(authConfig);

const PUBLIC_PAGE_PATHS = ["/login", "/register"];
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/github/webhook"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Legacy single-tenant mode: without a database there are no accounts to
  // sign in with, so don't lock the dashboard behind a login nobody can
  // pass. Once DATABASE_URL is set, every page and API route requires a
  // signed-in user.
  if (!process.env.DATABASE_URL) {
    return NextResponse.next();
  }

  const isPublicPage = PUBLIC_PAGE_PATHS.includes(pathname);
  const isPublicApi = PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
