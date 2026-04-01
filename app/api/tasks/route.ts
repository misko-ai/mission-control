import { NextRequest, NextResponse } from "next/server";
import {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  logTaskActivity,
  Task,
  TaskActivityEntry,
} from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function GET() {
  try {
    const tasks = await getTasks();
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, assignee } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const task: Task = {
      id: generateId(),
      title,
      description,
      assignee: assignee === "agent" ? "agent" : "user",
      column: "backlog",
      createdAt: now,
      updatedAt: now,
    };

    await addTask(task);

    const activity: TaskActivityEntry = {
      id: generateId(),
      taskId: task.id,
      taskTitle: task.title,
      action: "created",
      toColumn: "backlog",
      actor: "user",
      details: `Task "${task.title}" created and assigned to ${task.assignee === "agent" ? "AI Agent" : "User"}`,
      timestamp: now,
    };
    await logTaskActivity(activity);

    return NextResponse.json({ success: true, task });
  } catch {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await updateTask(id, updates);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const tasks = await getTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await deleteTask(id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
