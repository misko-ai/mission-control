import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import { getTasks, moveTask, logTaskActivity } from "@/lib/store";
import { logError } from "@/lib/logger";
import type { TaskActivityEntry } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const tasks = await getTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.column !== "review") {
      return NextResponse.json(
        { error: "Task must be in Review to approve" },
        { status: 400 }
      );
    }

    const result = await moveTask(taskId, "done");

    const activity: TaskActivityEntry = {
      id: generateId(),
      taskId,
      taskTitle: task.title,
      action: "approved",
      fromColumn: "review",
      toColumn: "done",
      actor: "user",
      details: `"${task.title}" approved and moved to Done`,
      timestamp: new Date().toISOString(),
    };
    await logTaskActivity(activity);

    return NextResponse.json({ success: true, task: result?.task });
  } catch (err) {
    logError("POST /api/tasks/approve", err);
    return NextResponse.json({ error: "Failed to approve task" }, { status: 500 });
  }
}
