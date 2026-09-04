import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEffortSummary } from "@/lib/server/project-store";

export async function GET() {
  const session = await auth();
  const summary = await getEffortSummary(session?.user?.id);
  return NextResponse.json({ summary });
}
