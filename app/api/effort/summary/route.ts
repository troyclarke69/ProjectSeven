import { NextResponse } from "next/server";
import { getEffortSummary } from "@/lib/server/project-store";

export async function GET() {
  const summary = await getEffortSummary();
  return NextResponse.json({ summary });
}
