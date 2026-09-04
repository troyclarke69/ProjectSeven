import { and, eq } from "drizzle-orm";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb, isPostgresConfigured } from "@/lib/db/client";
import { documentationHistory, effortEntries, projects as projectsTable } from "@/lib/db/schema";
import { getAdminDatabase, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { normalizeGitHubRepo } from "@/lib/github";
import { normalizeProject } from "@/lib/projects";
import { sampleProjects } from "@/lib/sample-data";
import { DocumentationHistoryEntry, EffortEntry, EffortSummary, ProjectRecord } from "@/lib/types";

// ---------------------------------------------------------------------------
// Postgres (Neon), via Drizzle, is the primary and only multi-tenant-safe
// data store. Every read/write below takes an `ownerId` and scopes the
// query to it. Once a database is configured, these functions never fall
// through to the legacy paths below, even if a caller forgets to pass an
// owner -- they simply return nothing, so a misconfigured route fails safe
// instead of leaking another tenant's data or a stale local sample.
//
// The Firebase and local-JSON paths are the pre-multi-tenant legacy
// fallback, kept only so a fresh clone with no environment variables set
// still runs out of the box for a single local user. They are NOT scoped by
// owner, and middleware.ts only allows the app to run without a login when
// DATABASE_URL is unset -- do not rely on either legacy path once real
// accounts exist.
// ---------------------------------------------------------------------------

const dataDir = path.join(process.cwd(), ".data");
const projectsFile = path.join(dataDir, "projects.json");
const historyFile = path.join(dataDir, "documentation-history.json");
const effortFile = path.join(dataDir, "effort-log.json");

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await ensureDataDir();
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

const sortProjects = (records: ProjectRecord[]) =>
  [...records].sort((left, right) => left.name.localeCompare(right.name));

function rowToProjectRecord(row: typeof projectsTable.$inferSelect): ProjectRecord {
  return normalizeProject({
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    platforms: row.platforms ?? [],
    tools: row.tools ?? [],
    startDate: row.startDate,
    modifiedAt: row.modifiedAt,
    githubUrl: row.githubUrl,
    websiteUrl: row.websiteUrl,
    status: row.status,
    documentation: row.documentation,
    documentationUpdatedAt: row.documentationUpdatedAt ?? "",
  });
}

function rowToHistoryEntry(row: typeof documentationHistory.$inferSelect): DocumentationHistoryEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName,
    documentation: row.documentation,
    reason: row.reason as DocumentationHistoryEntry["reason"],
    source: row.source as DocumentationHistoryEntry["source"],
    createdAt: row.createdAt,
    repository: row.repository ?? undefined,
    branch: row.branch ?? undefined,
    commitMessages: row.commitMessages ?? undefined,
  };
}

function rowToEffortEntry(row: typeof effortEntries.$inferSelect): EffortEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName,
    actor: row.actor as EffortEntry["actor"],
    source: row.source as EffortEntry["source"],
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    idleMinutesExcluded: row.idleMinutesExcluded ?? 0,
    createdAt: row.createdAt,
  };
}

export async function getProjects(ownerId?: string) {
  const db = getDb();
  if (db) {
    if (!ownerId) {
      return [];
    }

    const rows = await db.select().from(projectsTable).where(eq(projectsTable.ownerId, ownerId));
    return sortProjects(rows.map(rowToProjectRecord));
  }

  if (isFirebaseAdminConfigured) {
    const legacyDb = getAdminDatabase();
    if (!legacyDb) {
      return [];
    }

    const snapshot = await legacyDb.collection("projects").orderBy("name").get();
    if (snapshot.empty) {
      return sampleProjects;
    }

    return snapshot.docs.map((entry) =>
      normalizeProject({
        ...(entry.data() as ProjectRecord),
        id: entry.id,
      }),
    );
  }

  const rows = await readJsonFile<ProjectRecord[]>(projectsFile, []);
  if (!rows.length) {
    return sampleProjects;
  }

  return sortProjects(rows.map((row) => normalizeProject(row)));
}

export async function saveProject(project: ProjectRecord, ownerId?: string) {
  const normalized = normalizeProject(project);

  const db = getDb();
  if (db) {
    if (!ownerId) {
      throw new Error("Cannot save a project without a signed-in owner.");
    }

    const values = {
      ownerId,
      name: normalized.name,
      description: normalized.description,
      version: normalized.version,
      platforms: normalized.platforms,
      tools: normalized.tools,
      startDate: normalized.startDate,
      modifiedAt: normalized.modifiedAt,
      githubUrl: normalized.githubUrl,
      websiteUrl: normalized.websiteUrl,
      status: normalized.status,
      documentation: normalized.documentation,
      documentationUpdatedAt: normalized.documentationUpdatedAt || null,
    };

    const [existing] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, normalized.id), eq(projectsTable.ownerId, ownerId)))
      .limit(1);

    if (existing) {
      await db.update(projectsTable).set(values).where(eq(projectsTable.id, normalized.id));
    } else {
      await db.insert(projectsTable).values({ id: normalized.id, ...values });
    }

    return normalized;
  }

  if (isFirebaseAdminConfigured) {
    const legacyDb = getAdminDatabase();
    if (!legacyDb) {
      return normalized;
    }

    await legacyDb.collection("projects").doc(normalized.id).set(normalized, { merge: true });
    return normalized;
  }

  const existingProjects = await getProjects();
  const next = sortProjects([...existingProjects.filter((item) => item.id !== normalized.id), normalized]);
  await writeJsonFile(projectsFile, next);
  return normalized;
}

export async function saveDocumentationHistory(entry: DocumentationHistoryEntry, ownerId?: string) {
  const db = getDb();
  if (db) {
    if (!ownerId) {
      throw new Error("Cannot save documentation history without a signed-in owner.");
    }

    await db.insert(documentationHistory).values({
      id: entry.id,
      projectId: entry.projectId,
      ownerId,
      projectName: entry.projectName,
      documentation: entry.documentation,
      reason: entry.reason,
      source: entry.source,
      createdAt: entry.createdAt,
      repository: entry.repository,
      branch: entry.branch,
      commitMessages: entry.commitMessages,
    });
    return entry;
  }

  if (isFirebaseAdminConfigured) {
    const legacyDb = getAdminDatabase();
    if (!legacyDb) {
      return entry;
    }

    await legacyDb.collection("documentationHistory").doc(entry.id).set(entry);
    return entry;
  }

  const history = await readJsonFile<DocumentationHistoryEntry[]>(historyFile, []);
  const next = [entry, ...history].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  await writeJsonFile(historyFile, next);
  return entry;
}

export async function listDocumentationHistory(projectId: string, ownerId?: string, maxItems = 6) {
  const db = getDb();
  if (db) {
    if (!ownerId) {
      return [];
    }

    const rows = await db
      .select()
      .from(documentationHistory)
      .where(and(eq(documentationHistory.projectId, projectId), eq(documentationHistory.ownerId, ownerId)));

    return rows
      .map(rowToHistoryEntry)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, maxItems);
  }

  if (isFirebaseAdminConfigured) {
    const legacyDb = getAdminDatabase();
    if (!legacyDb) {
      return [];
    }

    const snapshot = await legacyDb
      .collection("documentationHistory")
      .where("projectId", "==", projectId)
      .orderBy("createdAt", "desc")
      .limit(maxItems)
      .get();

    return snapshot.docs.map((entry) => entry.data() as DocumentationHistoryEntry);
  }

  const history = await readJsonFile<DocumentationHistoryEntry[]>(historyFile, []);
  return history.filter((entry) => entry.projectId === projectId).slice(0, maxItems);
}

type OwnedProject = { project: ProjectRecord; ownerId?: string };

export async function findProjectsByRepository(repository: string): Promise<OwnedProject[]> {
  // Used by the GitHub webhook, which authenticates with a shared secret
  // rather than a user session, so this intentionally searches across every
  // tenant's projects to find the ones tracking the repo that just pushed.
  // The owner of each match is carried along so the refresh can still be
  // written back to the right tenant's rows.
  const normalizedRepository = normalizeGitHubRepo(repository);
  if (!normalizedRepository) {
    return [];
  }

  const db = getDb();
  if (db) {
    const rows = await db.select().from(projectsTable);
    return rows
      .filter((row) => normalizeGitHubRepo(row.githubUrl) === normalizedRepository)
      .map((row) => ({ project: rowToProjectRecord(row), ownerId: row.ownerId }));
  }

  if (isFirebaseAdminConfigured) {
    const legacyDb = getAdminDatabase();
    if (!legacyDb) {
      return [];
    }

    const snapshot = await legacyDb.collection("projects").get();
    return snapshot.docs
      .map((entry) =>
        normalizeProject({
          ...(entry.data() as ProjectRecord),
          id: entry.id,
        }),
      )
      .filter((project) => normalizeGitHubRepo(project.githubUrl) === normalizedRepository)
      .map((project) => ({ project }));
  }

  const allProjects = await getProjects();
  return allProjects
    .filter((project) => normalizeGitHubRepo(project.githubUrl) === normalizedRepository)
    .map((project) => ({ project }));
}

export async function saveEffortEntry(entry: EffortEntry, ownerId?: string) {
  const db = getDb();
  if (db) {
    if (!ownerId) {
      throw new Error("Cannot save an effort entry without a signed-in owner.");
    }

    await db.insert(effortEntries).values({
      id: entry.id,
      projectId: entry.projectId,
      ownerId,
      projectName: entry.projectName,
      actor: entry.actor,
      source: entry.source,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      durationMinutes: entry.durationMinutes,
      notes: entry.notes,
      idleMinutesExcluded: entry.idleMinutesExcluded ?? 0,
      createdAt: entry.createdAt,
    });
    return entry;
  }

  if (isFirebaseAdminConfigured) {
    const legacyDb = getAdminDatabase();
    if (!legacyDb) {
      return entry;
    }

    await legacyDb.collection("effortLog").doc(entry.id).set(entry);
    return entry;
  }

  const effort = await readJsonFile<EffortEntry[]>(effortFile, []);
  const next = [entry, ...effort].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  await writeJsonFile(effortFile, next);
  return entry;
}

export async function listEffortEntries(ownerId?: string, projectId?: string, maxItems = 40) {
  const db = getDb();
  if (db) {
    if (!ownerId) {
      return [];
    }

    const rows = projectId
      ? await db
          .select()
          .from(effortEntries)
          .where(and(eq(effortEntries.ownerId, ownerId), eq(effortEntries.projectId, projectId)))
      : await db.select().from(effortEntries).where(eq(effortEntries.ownerId, ownerId));

    return rows
      .map(rowToEffortEntry)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, maxItems);
  }

  if (isFirebaseAdminConfigured) {
    const legacyDb = getAdminDatabase();
    if (!legacyDb) {
      return [];
    }

    let snapshot;
    if (projectId) {
      snapshot = await legacyDb
        .collection("effortLog")
        .where("projectId", "==", projectId)
        .orderBy("createdAt", "desc")
        .limit(maxItems)
        .get();
    } else {
      snapshot = await legacyDb.collection("effortLog").orderBy("createdAt", "desc").limit(maxItems).get();
    }

    return snapshot.docs.map((entry) => entry.data() as EffortEntry);
  }

  const effort = await readJsonFile<EffortEntry[]>(effortFile, []);
  const filtered = projectId ? effort.filter((entry) => entry.projectId === projectId) : effort;
  return filtered.slice(0, maxItems);
}

export async function getEffortSummary(ownerId?: string) {
  const [projectList, effortList] = await Promise.all([
    getProjects(ownerId),
    listEffortEntries(ownerId, undefined, isPostgresConfigured ? 5000 : 500),
  ]);
  const map = new Map<string, EffortSummary>();

  for (const project of projectList) {
    map.set(project.id, {
      projectId: project.id,
      projectName: project.name || "Untitled project",
      humanMinutes: 0,
      aiMinutes: 0,
      totalMinutes: 0,
      lastActivityAt: project.modifiedAt,
    });
  }

  for (const entry of effortList) {
    const current = map.get(entry.projectId) ?? {
      projectId: entry.projectId,
      projectName: entry.projectName || "Untitled project",
      humanMinutes: 0,
      aiMinutes: 0,
      totalMinutes: 0,
      lastActivityAt: entry.endedAt,
    };

    if (entry.actor === "human") {
      current.humanMinutes += entry.durationMinutes;
    } else {
      current.aiMinutes += entry.durationMinutes;
    }

    current.totalMinutes += entry.durationMinutes;
    current.lastActivityAt = current.lastActivityAt > entry.endedAt ? current.lastActivityAt : entry.endedAt;
    map.set(entry.projectId, current);
  }

  return [...map.values()].sort((left, right) => right.totalMinutes - left.totalMinutes);
}
