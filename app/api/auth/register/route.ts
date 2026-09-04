import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getDb, isPostgresConfigured } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export async function POST(request: Request) {
  if (!isPostgresConfigured) {
    return NextResponse.json(
      { error: "Sign-up requires Postgres. Set DATABASE_URL to enable accounts." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { email?: string; password?: string; name?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const name = body.name?.trim() || null;

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "A valid email and a password of at least 8 characters are required." },
        { status: 400 },
      );
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "Database is not available." }, { status: 503 });
    }

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [created] = await db
      .insert(users)
      .values({ email, passwordHash, name })
      .returning({ id: users.id, email: users.email, name: users.name });

    return NextResponse.json({ user: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Registration failed: ${message}` }, { status: 500 });
  }
}
