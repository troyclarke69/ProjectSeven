import { generateProjectDocumentation } from "@/lib/ai/documentation";
import { saveDocumentationHistory, saveEffortEntry, saveProject } from "@/lib/server/project-store";
import { DocumentationHistoryEntry, DocumentationSource, DocumentationTrigger, EffortEntry, ProjectRecord } from "@/lib/types";

type RefreshOptions = {
  reason: DocumentationTrigger;
  source: DocumentationSource;
  repository?: string;
  branch?: string;
  commitMessages?: string[];
  persistProject?: boolean;
};

export async function refreshProjectDocumentation(
  project: ProjectRecord,
  options: RefreshOptions,
  ownerId?: string,
) {
  const startedAt = new Date().toISOString();
  const documentation = await generateProjectDocumentation(project, {
    reason: options.reason,
    source: options.source,
    repository: options.repository,
    branch: options.branch,
    commitMessages: options.commitMessages,
  });

  const updatedProject: ProjectRecord = {
    ...project,
    modifiedAt: new Date().toISOString(),
    documentation,
    documentationUpdatedAt: new Date().toISOString(),
  };

  if (options.persistProject ?? true) {
    await saveProject(updatedProject, ownerId);
  }

  const historyEntry: DocumentationHistoryEntry = {
    id: crypto.randomUUID(),
    projectId: updatedProject.id,
    projectName: updatedProject.name,
    documentation,
    reason: options.reason,
    source: options.source,
    createdAt: updatedProject.documentationUpdatedAt,
    repository: options.repository,
    branch: options.branch,
    commitMessages: options.commitMessages,
  };

  await saveDocumentationHistory(historyEntry, ownerId);

  const endedAt = new Date().toISOString();
  const durationMinutes = Math.max(
    1,
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000) || 1,
  );
  const effortEntry: EffortEntry = {
    id: crypto.randomUUID(),
    projectId: updatedProject.id,
    projectName: updatedProject.name,
    actor: "ai",
    source: "documentation_refresh",
    startedAt,
    endedAt,
    durationMinutes,
    notes: `Documentation refreshed via ${options.source}.`,
    createdAt: endedAt,
  };

  await saveEffortEntry(effortEntry, ownerId);

  return {
    project: updatedProject,
    historyEntry,
    effortEntry,
  };
}
