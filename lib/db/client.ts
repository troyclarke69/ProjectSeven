import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";

// Postgres (Neon) is the primary, multi-tenant data store. It is only "on"
// when DATABASE_URL is set; otherwise the app falls back to the legacy
// single-tenant paths in lib/server/project-store.ts (Firebase, then local
// JSON files) so a fresh clone still runs with zero configuration.
export const isPostgresConfigured = Boolean(process.env.DATABASE_URL);

let pool: Pool | undefined;

function getPool() {
  if (!isPostgresConfigured) {
    return undefined;
  }

  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return pool;
}

export function getDb() {
  const activePool = getPool();
  if (!activePool) {
    return null;
  }

  return drizzle(activePool, { schema });
}
