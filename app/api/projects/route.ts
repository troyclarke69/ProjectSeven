import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeProject } from "@/lib/projects";
import { getProjects, saveProject } from "@/lib/server/project-store";
import { ProjectRecordInput } from "@/lib/types";

export async function GET() {
  const session = await auth();
  const projects = await getProjects(session?.user?.id);
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = (await request.json()) as { project: ProjectRecordInput };
    if (!body?.project) {
      return NextResponse.json({ error: "A project payload is required." }, { status: 400 });
    }

    const project = normalizeProject(body.project);
    const saved = await saveProject(project, session?.user?.id);

    return NextResponse.json({ project: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Project save failed: ${message}` }, { status: 500 });
  }
}
