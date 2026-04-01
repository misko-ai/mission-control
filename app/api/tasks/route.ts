import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  logTaskActivity,
} from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_TASK_ASSIGNEE,
  VALID_TASK_PRIORITY,
} from "@/lib/validation";
import type { Task, TaskActivityEntry } from "@/lib/types";

export async function GET() {
  try {
    const tasks = await getTasks();
    return NextResponse.json({ tasks });
  } catch (err) {
    logError("GET /api/tasks", err);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const title = requireString(body.title, "title", { maxLength: 200 });
    const description = requireString(body.description, "description", { maxLength: 10000 });
    const assignee = optionalEnum(body.assignee, "assignee", VALID_TASK_ASSIGNEE, "user");
    const priority = optionalEnum(body.priority, "priority", VALID_TASK_PRIORITY, "medium");

    const errors = collectErrors(title, description, assignee, priority);
    const resp = validationResponse(errors);
    if (resp) return resp;

    const now = new Date().toISOString();
    const task: Task = {
      id: generateId(),
      title: title as string,
      description: description as string,
      assignee: assignee as Task["assignee"],
      priority: priority as Task["priority"],
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
  } catch (err) {
    logError("POST /api/tasks", err);
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

    if (updates.assignee !== undefined) {
      const v = optionalEnum(updates.assignee, "assignee", VALID_TASK_ASSIGNEE, "user");
      const errors = collectErrors(v);
      const resp = validationResponse(errors);
      if (resp) return resp;
    }

    if (updates.priority !== undefined) {
      const v = optionalEnum(updates.priority, "priority", VALID_TASK_PRIORITY, "medium");
      const errors = collectErrors(v);
      const resp = validationResponse(errors);
      if (resp) return resp;
    }

    if (updates.title !== undefined) {
      const v = requireString(updates.title, "title", { maxLength: 200 });
      const errors = collectErrors(v);
      const resp = validationResponse(errors);
      if (resp) return resp;
    }

    if (updates.description !== undefined) {
      const v = requireString(updates.description, "description", { maxLength: 10000 });
      const errors = collectErrors(v);
      const resp = validationResponse(errors);
      if (resp) return resp;
    }

    const found = await updateTask(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PUT /api/tasks", err);
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

    const found = await deleteTask(id);
    if (!found) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/tasks", err);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
