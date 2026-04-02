import { NextRequest, NextResponse } from "next/server";
import { getData, saveData, generateId } from "@/lib/db";
import { logTaskActivity } from "@/lib/store";
import { canClaim } from "@/lib/lifecycle";
import { logError } from "@/lib/logger";
import type { TaskRun, TaskActivityEntry } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, agentId } = body;

    if (!taskId || !agentId) {
      return NextResponse.json(
        { error: "taskId and agentId required" },
        { status: 400 }
      );
    }

    const data = await getData();
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const check = canClaim(task, agentId, data.team.agents);
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 409 });
    }

    const now = new Date().toISOString();
    const attempt = (task.runCount ?? 0) + 1;

    const run: TaskRun = {
      id: generateId(),
      taskId,
      agentId,
      attempt,
      status: "active",
      claimedAt: now,
      heartbeatAt: now,
    };

    task.currentRunId = run.id;
    task.runCount = attempt;
    task.column = "in-progress";
    task.updatedAt = now;

    data.taskRuns.unshift(run);
    data.taskRuns = data.taskRuns.slice(0, 200);
    await saveData(data);

    const activity: TaskActivityEntry = {
      id: generateId(),
      taskId,
      taskTitle: task.title,
      action: "picked-up",
      fromColumn: "backlog",
      toColumn: "in-progress",
      actor: "agent",
      details: `"${task.title}" claimed by agent (attempt #${attempt})`,
      timestamp: now,
    };
    await logTaskActivity(activity);

    return NextResponse.json({ success: true, run, task });
  } catch (err) {
    logError("POST /api/tasks/lifecycle/claim", err);
    return NextResponse.json({ error: "Failed to claim task" }, { status: 500 });
  }
}
