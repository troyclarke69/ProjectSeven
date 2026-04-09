import { ProjectRecord } from "@/lib/types";

const today = new Date().toISOString().slice(0, 10);

export const sampleProjects: ProjectRecord[] = [
  {
    id: "project-seven",
    name: "Project Seven",
    description: "A central registry for shipping projects, stack choices, and AI-maintained documentation.",
    version: "0.1.0",
    platforms: ["Web"],
    tools: ["Next.js", "Firebase", "Gemini"],
    startDate: today,
    modifiedAt: new Date().toISOString(),
    githubUrl: "https://github.com/your-org/project-seven",
    websiteUrl: "https://project-seven.example.com",
    status: "Planning",
    documentation: "Seed documentation will appear here after the first save.",
    documentationUpdatedAt: "",
  },
];
