import { NextResponse } from "next/server";
import { normalizeProject } from "@/lib/projects";
import { refreshProjectDocumentation } from "@/lib/server/documentation";
import { ProjectRecordInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      project: ProjectRecordInput;
      persist?: boolean;
      reason?: "metadata_update" | "code_change" | "manual_refresh";
      source?: "dashboard" | "github_webhook" | "system";
      repository?: string;
      branch?: string;
      commitMessages?: string[];
    };
    if (!body?.project) {
      return NextResponse.json(
        {
          error: "A project payload is required.",
        },
        { status: 400 },
      );
    }

    const project = normalizeProject(body.project);
    const refreshed = await refreshProjectDocumentation(project, {
      reason: body.reason ?? "manual_refresh",
      source: body.source ?? "system",
      repository: body.repository,
      branch: body.branch,
      commitMessages: body.commitMessages,
      persistProject: body.persist ?? true,
    });

    return NextResponse.json({
      project: refreshed.project,
      documentation: refreshed.project.documentation,
      documentationUpdatedAt: refreshed.project.documentationUpdatedAt,
      historyEntry: refreshed.historyEntry,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: `Documentation generation failed: ${message}`,
      },
      { status: 500 },
    );
  }
}
