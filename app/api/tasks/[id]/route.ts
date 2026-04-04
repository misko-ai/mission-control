import { NextRequest, NextResponse } from "next/server";
import { getTasks, updateTask } from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_TASK_ASSIGNEE,
  VALID_TASK_PRIORITY,
} from "@/lib/validation";
import type { Task, TaskColumn } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const tasks = await getTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (err) {
    logError("GET /api/tasks/[id]", err);
    return NextResponse.json({ error: "Failed to load task" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Validate assignee
    if (body.assignee !== undefined) {
      const v = optionalEnum(body.assignee, "assignee", VALID_TASK_ASSIGNEE, "user");
      const errors = collectErrors(v);
      const resp = validationResponse(errors);
      if (resp) return resp;
    }

    // Validate priority
    if (body.priority !== undefined) {
      const v = optionalEnum(body.priority, "priority", VALID_TASK_PRIORITY, "medium");
      const errors = collectErrors(v);
      const resp = validationResponse(errors);
      if (resp) return resp;
    }

    // Validate title
    if (body.title !== undefined) {
      const v = requireString(body.title, "title", { maxLength: 200 });
      const errors = collectErrors(v);
      const resp = validationResponse(errors);
      if (resp) return resp;
    }

    // Validate description
    if (body.description !== undefined) {
      const v = requireString(body.description, "description", { maxLength: 10000 });
      const errors = collectErrors(v);
      const resp = validationResponse(errors);
      if (resp) return resp;
    }

    // Build updates object — only include fields that are present
    const updates: Partial<Task> = {};
    if (body.column !== undefined) updates.column = body.column as TaskColumn;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.assignee !== undefined) updates.assignee = body.assignee;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.blockReason !== undefined) updates.blockReason = body.blockReason;

    const found = await updateTask(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Return the updated task
    const tasks = await getTasks();
    const task = tasks.find((t) => t.id === id);
    return NextResponse.json({ success: true, task });
  } catch (err) {
    logError("PUT /api/tasks/[id]", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const tasks = await getTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const { deleteTask } = await import("@/lib/store");
    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/tasks/[id]", err);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
