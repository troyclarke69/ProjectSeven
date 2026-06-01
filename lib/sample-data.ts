import { ProjectRecord } from "@/lib/types";

const today = new Date().toISOString().slice(0, 10);

export const sampleProjects: ProjectRecord[] = [
  {
    id: "project-one",
    name: "Project Name",
    description: "There is something great about the project.",
    version: "0.1.0",
    platforms: ["Web"],
    tools: ["Hammer", "Nails", "Saw"],
    startDate: today,
    modifiedAt: new Date().toISOString(),
    githubUrl: "https://github.com/your-org/projectName",
    websiteUrl: "https://projectName.example.com",
    status: "Planning",
    documentation: "Seed documentation will appear here after the first save.",
    documentationUpdatedAt: "",
  },
];
