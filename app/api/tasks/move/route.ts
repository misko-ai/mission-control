import { NextRequest, NextResponse } from "next/server";
import { moveTask, logTaskActivity, TaskActivityEntry, TaskColumn } from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

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
  } catch {
    return NextResponse.json({ error: "Failed to move task" }, { status: 500 });
  }
}
