import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { refreshProjectDocumentation } from "@/lib/server/documentation";
import { findProjectsByRepository } from "@/lib/server/project-store";

type GitHubPushPayload = {
  ref?: string;
  repository?: {
    full_name?: string;
    html_url?: string;
  };
  commits?: Array<{
    id?: string;
    message?: string;
  }>;
};

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }

  if (!signature) {
    return false;
  }

  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

const branchFromRef = (ref?: string) => ref?.split("/").pop() ?? "";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const event = request.headers.get("x-github-event");
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Webhook signature validation failed." }, { status: 401 });
  }

  if (event === "ping") {
    return NextResponse.json({ ok: true, message: "GitHub webhook received." });
  }

  if (event !== "push") {
    return NextResponse.json({ ok: true, message: `Ignored GitHub event: ${event ?? "unknown"}.` });
  }

  const payload = JSON.parse(rawBody) as GitHubPushPayload;
  const repository = payload.repository?.full_name || payload.repository?.html_url;

  if (!repository) {
    return NextResponse.json({ error: "Push payload did not include repository details." }, { status: 400 });
  }

  const matches = await findProjectsByRepository(repository);
  if (!matches.length) {
    return NextResponse.json({
      ok: true,
      matchedProjects: 0,
      message: `No tracked projects matched ${repository}.`,
    });
  }

  const commitMessages = (payload.commits ?? [])
    .map((commit) => commit.message?.trim())
    .filter((message): message is string => Boolean(message));

  const refreshedProjects = await Promise.all(
    matches.map(({ project, ownerId }) =>
      refreshProjectDocumentation(
        project,
        {
          reason: "code_change",
          source: "github_webhook",
          repository,
          branch: branchFromRef(payload.ref),
          commitMessages,
        },
        ownerId,
      ),
    ),
  );

  return NextResponse.json({
    ok: true,
    matchedProjects: refreshedProjects.length,
    projectIds: refreshedProjects.map(({ project }) => project.id),
    repository,
  });
}
