import { NextRequest, NextResponse } from "next/server";
import { getData, saveData, generateId } from "@/lib/db";
import { moveTask, logTaskActivity } from "@/lib/store";
import { logError } from "@/lib/logger";
import type { TaskActivityEntry, TaskColumn } from "@/lib/types";

const validColumns: TaskColumn[] = ["backlog", "in-progress", "review", "done", "blocked"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, toColumn, actor } = body;

    if (!taskId || !toColumn) {
      return NextResponse.json(
        { error: "taskId and toColumn required" },
        { status: 400 }
      );
    }

    if (!validColumns.includes(toColumn as TaskColumn)) {
      return NextResponse.json(
        { error: "Invalid column" },
        { status: 400 }
      );
    }

    const targetColumn = toColumn as TaskColumn;

    // Guard: reject moves on agent tasks with an active run (except emergency override to blocked)
    const data = await getData();
    const task = data.tasks.find((t) => t.id === taskId);
    if (task?.currentRunId && task.assignee === "agent") {
      if (targetColumn === "blocked") {
        // Emergency override: cancel the active run
        const run = data.taskRuns.find((r) => r.id === task.currentRunId);
        if (run && run.status === "active") {
          run.status = "cancelled";
          run.finishedAt = new Date().toISOString();
          run.terminalReason = "operator emergency override";
        }
        task.currentRunId = undefined;
        task.updatedAt = new Date().toISOString();
        await saveData(data);
      } else {
        return NextResponse.json(
          { error: "Task has an active agent run. Use lifecycle endpoints or move to blocked to force-cancel." },
          { status: 409 }
        );
      }
    }

    const result = await moveTask(taskId, targetColumn);
    if (!result) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const columnLabels: Record<TaskColumn, string> = {
      backlog: "Backlog",
      "in-progress": "In Progress",
      review: "Review",
      done: "Done",
      blocked: "Blocked",
    };

    const activity: TaskActivityEntry = {
      id: generateId(),
      taskId,
      taskTitle: result.task.title,
      action: "moved",
      fromColumn: result.fromColumn,
      toColumn: targetColumn,
      actor: actor === "agent" ? "agent" : "user",
      details: `"${result.task.title}" moved from ${columnLabels[result.fromColumn]} to ${columnLabels[targetColumn]}`,
      timestamp: new Date().toISOString(),
    };
    await logTaskActivity(activity);

    return NextResponse.json({ success: true, task: result.task });
  } catch (err) {
    logError("POST /api/tasks/move", err);
    return NextResponse.json({ error: "Failed to move task" }, { status: 500 });
  }
}
