import { NextRequest, NextResponse } from "next/server";
import { linkArtifactsToRun } from "@/lib/store";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, bugIds, projectIds, docIds } = body;

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    if (!bugIds?.length && !projectIds?.length && !docIds?.length) {
      return NextResponse.json(
        { error: "At least one of bugIds, projectIds, or docIds required" },
        { status: 400 }
      );
    }

    const run = await linkArtifactsToRun(runId, { bugIds, projectIds, docIds });
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, run });
  } catch (err) {
    logError("POST /api/tasks/runs/link-artifacts", err);
    return NextResponse.json(
      { error: "Failed to link artifacts" },
      { status: 500 }
    );
  }
}
