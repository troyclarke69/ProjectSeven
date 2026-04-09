export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  version: string;
  platforms: string[];
  tools: string[];
  startDate: string;
  modifiedAt: string;
  githubUrl: string;
  websiteUrl: string;
  status: string;
  documentation: string;
  documentationUpdatedAt: string;
};

export type ProjectRecordInput = Omit<ProjectRecord, "modifiedAt" | "documentation" | "documentationUpdatedAt"> & {
  modifiedAt?: string;
  documentation?: string;
  documentationUpdatedAt?: string;
};

export type DocumentationTrigger = "metadata_update" | "code_change" | "manual_refresh";

export type DocumentationSource = "dashboard" | "github_webhook" | "system";

export type DocumentationHistoryEntry = {
  id: string;
  projectId: string;
  projectName: string;
  documentation: string;
  reason: DocumentationTrigger;
  source: DocumentationSource;
  createdAt: string;
  repository?: string;
  branch?: string;
  commitMessages?: string[];
};

export type EffortActor = "human" | "ai";

export type EffortSource = "manual_timer" | "manual_entry" | "documentation_refresh" | "system";

export type EffortEntry = {
  id: string;
  projectId: string;
  projectName: string;
  actor: EffortActor;
  source: EffortSource;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  notes: string;
  idleMinutesExcluded?: number;
  createdAt: string;
};

export type EffortSummary = {
  projectId: string;
  projectName: string;
  humanMinutes: number;
  aiMinutes: number;
  totalMinutes: number;
  lastActivityAt: string;
};
