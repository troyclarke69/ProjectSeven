import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEffortSummary, listEffortEntries, saveEffortEntry } from "@/lib/server/project-store";
import { EffortEntry } from "@/lib/types";

type EffortRequest = {
  projectId: string;
  projectName: string;
  actor: "human" | "ai";
  source: "manual_timer" | "manual_entry" | "documentation_refresh" | "system";
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  notes?: string;
  idleMinutesExcluded?: number;
};

export async function GET(request: Request) {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;

  const [entries, summary] = await Promise.all([
    listEffortEntries(session?.user?.id, projectId),
    getEffortSummary(session?.user?.id),
  ]);
  return NextResponse.json({ entries, summary });
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = (await request.json()) as EffortRequest;
    if (!body.projectId || !body.projectName || !body.actor || !body.source || !body.startedAt || !body.endedAt) {
      return NextResponse.json({ error: "Incomplete effort entry payload." }, { status: 400 });
    }

    const entry: EffortEntry = {
      id: crypto.randomUUID(),
      projectId: body.projectId,
      projectName: body.projectName,
      actor: body.actor,
      source: body.source,
      startedAt: body.startedAt,
      endedAt: body.endedAt,
      durationMinutes: Math.max(1, Math.round(body.durationMinutes)),
      notes: body.notes ?? "",
      idleMinutesExcluded: body.idleMinutesExcluded ?? 0,
      createdAt: new Date().toISOString(),
    };

    await saveEffortEntry(entry, session?.user?.id);
    const summary = await getEffortSummary(session?.user?.id);

    return NextResponse.json({ entry, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Effort save failed: ${message}` }, { status: 500 });
  }
}
