import Anthropic from "@anthropic-ai/sdk";
import type { DocumentationContext } from "@/lib/ai/types";
import { ProjectRecord } from "@/lib/types";

const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

export const isAnthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

function buildPrompt(project: ProjectRecord, context?: DocumentationContext) {
  return `
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
}

export async function generateWithAnthropic(project: ProjectRecord, context?: DocumentationContext) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: "user", content: buildPrompt(project, context) }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );

  return textBlock?.text ?? "";
}
