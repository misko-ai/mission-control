import { NextRequest, NextResponse } from "next/server";
import { getData, saveData } from "@/lib/db";
import { syncAgentStatus } from "@/lib/lifecycle";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, agentId } = body;

    if (!runId || !agentId) {
      return NextResponse.json(
        { error: "runId and agentId required" },
        { status: 400 }
      );
    }

    const data = await getData();
    const run = data.taskRuns.find((r) => r.id === runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (run.agentId !== agentId) {
      return NextResponse.json(
        { error: "Agent does not own this run" },
        { status: 403 }
      );
    }

    if (run.status !== "active") {
      return NextResponse.json(
        { error: "Run is already terminal" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    run.heartbeatAt = now;
    syncAgentStatus(agentId, data);
    await saveData(data);

    return NextResponse.json({ success: true, heartbeatAt: now });
  } catch (err) {
    logError("POST /api/tasks/lifecycle/heartbeat", err);
    return NextResponse.json({ error: "Failed to record heartbeat" }, { status: 500 });
  }
}
