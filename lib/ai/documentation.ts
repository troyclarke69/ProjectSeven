import { generateWithAnthropic, isAnthropicConfigured } from "@/lib/anthropic";
import { generateWithGemini, isGeminiConfigured } from "@/lib/gemini";
import type { DocumentationContext } from "@/lib/ai/types";
import { ProjectRecord } from "@/lib/types";

// Provider order: Anthropic (Claude) is the primary AI writer, Gemini is
// kept wired up as a secondary option, and a deterministic template is the
// last-resort fallback so documentation refresh never hard-fails just
// because no AI provider is configured (or a provider call errors out).

function fallbackDocumentation(project: ProjectRecord, context?: DocumentationContext) {
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
}

export async function generateProjectDocumentation(project: ProjectRecord, context?: DocumentationContext) {
  if (isAnthropicConfigured) {
    try {
      const text = await generateWithAnthropic(project, context);
      if (text) {
        return text;
      }
    } catch (error) {
      console.error(
        "Anthropic documentation generation failed, falling back:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (isGeminiConfigured) {
    try {
      const text = await generateWithGemini(project, context);
      if (text) {
        return text;
      }
    } catch (error) {
      console.error(
        "Gemini documentation generation failed, falling back:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return fallbackDocumentation(project, context);
}
