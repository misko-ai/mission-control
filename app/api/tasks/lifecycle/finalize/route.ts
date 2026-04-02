import { NextRequest, NextResponse } from "next/server";
import { getData, saveData, generateId } from "@/lib/db";
import { logTaskActivity } from "@/lib/store";
import { canFinalize } from "@/lib/lifecycle";
import { logError } from "@/lib/logger";
import { isOneOf } from "@/lib/validation";
import type { TaskActivityEntry } from "@/lib/types";

const VALID_OUTCOMES = ["success", "failure", "cancelled"] as const;
type Outcome = (typeof VALID_OUTCOMES)[number];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, agentId, outcome, reason, skipReview } = body;

    if (!runId || !agentId || !outcome) {
      return NextResponse.json(
        { error: "runId, agentId, and outcome required" },
        { status: 400 }
      );
    }

    if (!isOneOf(outcome, VALID_OUTCOMES)) {
      return NextResponse.json(
        { error: `outcome must be one of: ${VALID_OUTCOMES.join(", ")}` },
        { status: 400 }
      );
    }

    const data = await getData();
    const run = data.taskRuns.find((r) => r.id === runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Idempotency: if already terminal, return success with existing state
    if (run.status !== "active") {
      const task = data.tasks.find((t) => t.id === run.taskId);
      return NextResponse.json({ success: true, run, task, idempotent: true });
    }

    const task = data.tasks.find((t) => t.id === run.taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const check = canFinalize(task, run, agentId);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 409 });
    }

    const now = new Date().toISOString();
    const typedOutcome = outcome as Outcome;

    // Update run
    run.finishedAt = now;
    run.terminalReason = reason || typedOutcome;

    // Update task based on outcome
    let toColumn: string;
    switch (typedOutcome) {
      case "success":
        run.status = "success";
        if (skipReview) {
          task.column = "done";
          task.completedAt = now;
          toColumn = "done";
        } else {
          task.column = "review";
          toColumn = "review";
        }
        break;
      case "failure":
        run.status = "failure";
        task.column = "blocked";
        task.blockReason = reason || "Agent reported failure";
        toColumn = "blocked";
        break;
      case "cancelled":
        run.status = "cancelled";
        task.column = "backlog";
        toColumn = "backlog";
        break;
    }

    task.currentRunId = undefined;
    task.updatedAt = now;
    await saveData(data);

    const activity: TaskActivityEntry = {
      id: generateId(),
      taskId: task.id,
      taskTitle: task.title,
      action: typedOutcome === "success" ? "completed" : "moved",
      fromColumn: "in-progress",
      toColumn: toColumn! as TaskActivityEntry["toColumn"],
      actor: "agent",
      details: `"${task.title}" finalized: ${typedOutcome}${reason ? ` — ${reason}` : ""}`,
      timestamp: now,
    };
    await logTaskActivity(activity);

    return NextResponse.json({ success: true, run, task });
  } catch (err) {
    logError("POST /api/tasks/lifecycle/finalize", err);
    return NextResponse.json({ error: "Failed to finalize run" }, { status: 500 });
  }
}
