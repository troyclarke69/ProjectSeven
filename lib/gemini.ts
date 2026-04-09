import { GoogleGenAI } from "@google/genai";
import { ProjectRecord } from "@/lib/types";

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY);

type DocumentationContext = {
  reason?: string;
  source?: string;
  repository?: string;
  branch?: string;
  commitMessages?: string[];
};

const fallbackDocumentation = (project: ProjectRecord, context?: DocumentationContext) => {
  const platforms = project.platforms.length ? project.platforms.join(", ") : "Not specified";
  const tools = project.tools.length ? project.tools.join(", ") : "Not specified";
  const changeNotes = context?.commitMessages?.length
    ? context.commitMessages.map((message) => `- ${message}`).join("\n")
    : "- No commit details were supplied for this refresh.";

  return [
    `# ${project.name || "Untitled Project"}`,
    "",
    "## Snapshot",
    project.description || "No description has been written yet.",
    "",
    "## Delivery Context",
    `- Version: ${project.version || "Unspecified"}`,
    `- Status: ${project.status || "Unspecified"}`,
    `- Platforms: ${platforms}`,
    `- Tools: ${tools}`,
    `- Source: ${project.githubUrl || "Not linked"}`,
    `- Website: ${project.websiteUrl || "Not linked"}`,
    "",
    "## Refresh Context",
    `- Reason: ${context?.reason || "manual_refresh"}`,
    `- Triggered by: ${context?.source || "system"}`,
    `- Repository: ${context?.repository || "Not linked"}`,
    `- Branch: ${context?.branch || "Not specified"}`,
    "",
    "## Recent Change Notes",
    changeNotes,
    "",
    "## Suggested Next Documentation Pass",
    "- Add implementation notes for key flows.",
    "- Capture architecture decisions as they stabilize.",
    "- Attach release notes when the version changes.",
  ].join("\n");
};

export async function generateProjectDocumentation(project: ProjectRecord, context?: DocumentationContext) {
  if (!isGeminiConfigured) {
    return fallbackDocumentation(project, context);
  }

  const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
  });

  const prompt = `
You are maintaining living technical documentation for a project portfolio.
Write concise markdown for the project below.

Project metadata:
${JSON.stringify(project, null, 2)}

Refresh context:
${JSON.stringify(context ?? {}, null, 2)}

Output requirements:
- Start with an H1 using the project name.
- Include sections: Snapshot, Stack, Operational Notes, Recommended Next Steps.
- Include a short Refresh Context section when recent changes were provided.
- Keep it under 350 words.
- Mention missing metadata where relevant instead of inventing details.
`.trim();

  const response = await client.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text ?? fallbackDocumentation(project, context);
}
