import { NextResponse } from "next/server";
import { listDocumentationHistory } from "@/lib/server/project-store";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const history = await listDocumentationHistory(id);
  return NextResponse.json({ history });
}
