import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listDocumentationHistory } from "@/lib/server/project-store";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  const history = await listDocumentationHistory(id, session?.user?.id);
  return NextResponse.json({ history });
}
