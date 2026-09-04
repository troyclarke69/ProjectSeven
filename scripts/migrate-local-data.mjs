// One-time migration: copies the legacy .data/*.json files into Postgres,
// scoped to a single owner account. Run after creating that account via the
// app's /register page:
//
//   node --env-file=.env.local scripts/migrate-local-data.mjs you@example.com
//
// Safe to re-run: rows are inserted with `on conflict (id) do nothing`.

import { readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

const ownerEmail = process.argv[2];

if (!ownerEmail) {
  console.error("Usage: node --env-file=.env.local scripts/migrate-local-data.mjs <owner-email>");
  console.error("(that account must already exist -- create it at /register first)");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

const dataDir = path.join(process.cwd(), ".data");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value) => UUID_RE.test(value ?? "");

async function readJson(file, fallback) {
  try {
    const content = await readFile(path.join(dataDir, file), "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows: ownerRows } = await client.query("select id from users where email = $1", [
      ownerEmail.trim().toLowerCase(),
    ]);

    if (!ownerRows.length) {
      console.error(`No account found for ${ownerEmail}. Create one at /register first, then re-run this script.`);
      process.exitCode = 1;
      return;
    }

    const ownerId = ownerRows[0].id;
    const now = new Date().toISOString();

    const projects = await readJson("projects.json", []);
    const history = await readJson("documentation-history.json", []);
    const effort = await readJson("effort-log.json", []);

    const idMap = new Map();

    for (const project of projects) {
      const newId = isUuid(project.id) ? project.id : crypto.randomUUID();
      idMap.set(project.id, newId);

      await client.query(
        `insert into projects
           (id, owner_id, name, description, version, platforms, tools, start_date,
            modified_at, github_url, website_url, status, documentation, documentation_updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict (id) do nothing`,
        [
          newId,
          ownerId,
          project.name ?? "",
          project.description ?? "",
          project.version ?? "",
          JSON.stringify(project.platforms ?? []),
          JSON.stringify(project.tools ?? []),
          project.startDate ?? now.slice(0, 10),
          project.modifiedAt ?? now,
          project.githubUrl ?? "",
          project.websiteUrl ?? "",
          project.status ?? "Planning",
          project.documentation ?? "",
          project.documentationUpdatedAt || null,
        ],
      );
    }

    let migratedHistory = 0;
    for (const entry of history) {
      const projectId = idMap.get(entry.projectId);
      if (!projectId) continue;

      await client.query(
        `insert into documentation_history
           (id, project_id, owner_id, project_name, documentation, reason, source,
            created_at, repository, branch, commit_messages)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (id) do nothing`,
        [
          isUuid(entry.id) ? entry.id : crypto.randomUUID(),
          projectId,
          ownerId,
          entry.projectName ?? "",
          entry.documentation ?? "",
          entry.reason ?? "manual_refresh",
          entry.source ?? "system",
          entry.createdAt ?? now,
          entry.repository ?? null,
          entry.branch ?? null,
          entry.commitMessages ? JSON.stringify(entry.commitMessages) : null,
        ],
      );
      migratedHistory += 1;
    }

    let migratedEffort = 0;
    for (const entry of effort) {
      const projectId = idMap.get(entry.projectId);
      if (!projectId) continue;

      await client.query(
        `insert into effort_entries
           (id, project_id, owner_id, project_name, actor, source, started_at, ended_at,
            duration_minutes, notes, idle_minutes_excluded, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (id) do nothing`,
        [
          isUuid(entry.id) ? entry.id : crypto.randomUUID(),
          projectId,
          ownerId,
          entry.projectName ?? "",
          entry.actor ?? "human",
          entry.source ?? "manual_entry",
          entry.startedAt ?? now,
          entry.endedAt ?? now,
          entry.durationMinutes ?? 1,
          entry.notes ?? "",
          entry.idleMinutesExcluded ?? 0,
          entry.createdAt ?? now,
        ],
      );
      migratedEffort += 1;
    }

    console.log(
      `Migrated ${projects.length} project(s), ${migratedHistory} documentation history entry(ies), ` +
        `${migratedEffort} effort entry(ies) to ${ownerEmail}.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
