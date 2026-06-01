import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminDatabase, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { normalizeGitHubRepo } from "@/lib/github";
import { normalizeProject } from "@/lib/projects";
import { sampleProjects } from "@/lib/sample-data";
import { DocumentationHistoryEntry, EffortEntry, EffortSummary, ProjectRecord } from "@/lib/types";

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

const sortProjects = (projects: ProjectRecord[]) =>
  [...projects].sort((left, right) => left.name.localeCompare(right.name));

export async function getProjects() {
  if (isFirebaseAdminConfigured) {
    const db = getAdminDatabase();
    if (!db) {
      return [];
    }

    const snapshot = await db.collection("projects").orderBy("name").get();
    console.log(`Fetched ${snapshot.size} projects from Firebase`);

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

export async function saveProject(project: ProjectRecord) {
  const normalized = normalizeProject(project);

  if (isFirebaseAdminConfigured) {
    const db = getAdminDatabase();
    if (!db) {
      return normalized;
    }

    await db.collection("projects").doc(normalized.id).set(normalized, { merge: true });
    return normalized;
  }

  const projects = await getProjects();
  const next = sortProjects([...projects.filter((item) => item.id !== normalized.id), normalized]);
  await writeJsonFile(projectsFile, next);
  return normalized;
}

export async function saveDocumentationHistory(entry: DocumentationHistoryEntry) {
  if (isFirebaseAdminConfigured) {
    const db = getAdminDatabase();
    if (!db) {
      return entry;
    }

    await db.collection("documentationHistory").doc(entry.id).set(entry);
    return entry;
  }

  const history = await readJsonFile<DocumentationHistoryEntry[]>(historyFile, []);
  const next = [entry, ...history].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  await writeJsonFile(historyFile, next);
  return entry;
}

export async function listDocumentationHistory(projectId: string, maxItems = 6) {
  if (isFirebaseAdminConfigured) {
    const db = getAdminDatabase();
    if (!db) {
      return [];
    }

    const snapshot = await db
      .collection("documentationHistory")
      .where("projectId", "==", projectId)
      .orderBy("createdAt", "desc")
      .limit(maxItems)
      .get();

    console.log(`Fetched ${snapshot.size} documentation history entries for project ${projectId} from Firebase`);
    return snapshot.docs.map((entry) => entry.data() as DocumentationHistoryEntry);
  }

  const history = await readJsonFile<DocumentationHistoryEntry[]>(historyFile, []);
  return history.filter((entry) => entry.projectId === projectId).slice(0, maxItems);
}

export async function findProjectsByRepository(repository: string) {
  const normalizedRepository = normalizeGitHubRepo(repository);
  if (!normalizedRepository) {
    return [];
  }

  if (isFirebaseAdminConfigured) {
    const db = getAdminDatabase();
    if (!db) {
      return [];
    }

    const snapshot = await db.collection("projects").get();

    return snapshot.docs
      .map((entry) =>
        normalizeProject({
          ...(entry.data() as ProjectRecord),
          id: entry.id,
        }),
      )
      .filter((project) => normalizeGitHubRepo(project.githubUrl) === normalizedRepository);
  }

  const projects = await getProjects();
  return projects.filter((project) => normalizeGitHubRepo(project.githubUrl) === normalizedRepository);
}

export async function saveEffortEntry(entry: EffortEntry) {
  if (isFirebaseAdminConfigured) {
    const db = getAdminDatabase();
    if (!db) {
      return entry;
    }

    await db.collection("effortLog").doc(entry.id).set(entry);
    return entry;
  }

  const effort = await readJsonFile<EffortEntry[]>(effortFile, []);
  const next = [entry, ...effort].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  await writeJsonFile(effortFile, next);
  return entry;
}

export async function listEffortEntries(projectId?: string, maxItems = 40) {
  if (isFirebaseAdminConfigured) {
    const db = getAdminDatabase();
    if (!db) {
      return [];
    }

    let snapshot;

    if (projectId) {
      snapshot = await db
        .collection("effortLog")
        .where("projectId", "==", projectId)
        .orderBy("createdAt", "desc")
        .limit(maxItems)
        .get();
    } else {
      snapshot = await db.collection("effortLog").orderBy("createdAt", "desc").limit(maxItems).get();
    }
    
    console.log(`Fetched ${snapshot.size} effort entries for project ${projectId} from Firebase`);
    return snapshot.docs.map((entry) => entry.data() as EffortEntry);
  }

  const effort = await readJsonFile<EffortEntry[]>(effortFile, []);
  const filtered = projectId ? effort.filter((entry) => entry.projectId === projectId) : effort;
  return filtered.slice(0, maxItems);
}

export async function getEffortSummary() {
  const [projects, effortEntries] = await Promise.all([getProjects(), listEffortEntries(undefined, 500)]);
  const map = new Map<string, EffortSummary>();

  for (const project of projects) {
    map.set(project.id, {
      projectId: project.id,
      projectName: project.name || "Untitled project",
      humanMinutes: 0,
      aiMinutes: 0,
      totalMinutes: 0,
      lastActivityAt: project.modifiedAt,
    });
  }

  for (const entry of effortEntries) {
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
