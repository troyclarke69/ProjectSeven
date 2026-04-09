import { ProjectRecord, ProjectRecordInput } from "@/lib/types";

export const blankProject = (): ProjectRecord => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  version: "0.1.0",
  platforms: [],
  tools: [],
  startDate: new Date().toISOString().slice(0, 10),
  modifiedAt: new Date().toISOString(),
  githubUrl: "",
  websiteUrl: "",
  status: "Planning",
  documentation: "",
  documentationUpdatedAt: "",
});

export const normalizeProject = (input: ProjectRecordInput): ProjectRecord => ({
  id: input.id,
  name: input.name ?? "",
  description: input.description ?? "",
  version: input.version ?? "",
  platforms: input.platforms ?? [],
  tools: input.tools ?? [],
  startDate: input.startDate ?? new Date().toISOString().slice(0, 10),
  modifiedAt: input.modifiedAt ?? new Date().toISOString(),
  githubUrl: input.githubUrl ?? "",
  websiteUrl: input.websiteUrl ?? "",
  status: input.status ?? "Planning",
  documentation: input.documentation ?? "",
  documentationUpdatedAt: input.documentationUpdatedAt ?? "",
});

export const parseTagInput = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const formatTagInput = (items: string[]) => items.join(", ");

export const formatDateTime = (value: string) => {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};
