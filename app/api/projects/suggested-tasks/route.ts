import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import {
  addSuggestedTask,
  updateSuggestedTask,
  deleteSuggestedTask,
} from "@/lib/store";
import {
  requireString,
  requireEnum,
  optionalString,
  collectErrors,
  validationResponse,
  VALID_SUGGESTED_TASK_STATUS,
} from "@/lib/validation";
import type { SuggestedTask } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const title = requireString(body.title, "title", { maxLength: 200 });
    const description = optionalString(body.description, "description", { maxLength: 1000 });
    const errors = collectErrors(title, description);
    const resp = validationResponse(errors);
    if (resp) return resp;

    const task: SuggestedTask = {
      id: generateId(),
      title: title as string,
      description: (description as string) || "",
      status: "proposed",
    };

    const found = await addSuggestedTask(body.projectId, task);
    if (!found) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, suggestedTask: task });
  } catch {
    return NextResponse.json({ error: "Failed to add suggested task" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, taskId, ...updates } = body;

    if (!projectId || !taskId) {
      return NextResponse.json({ error: "projectId and taskId are required" }, { status: 400 });
    }

    const validations: unknown[] = [];
    if (updates.title !== undefined) {
      validations.push(requireString(updates.title, "title", { maxLength: 200 }));
    }
    if (updates.status !== undefined) {
      validations.push(requireEnum(updates.status, "status", VALID_SUGGESTED_TASK_STATUS));
    }
    if (updates.description !== undefined) {
      validations.push(optionalString(updates.description, "description", { maxLength: 1000 }));
    }

    const errors = collectErrors(...validations);
    const resp = validationResponse(errors);
    if (resp) return resp;

    const found = await updateSuggestedTask(projectId, taskId, updates);
    if (!found) {
      return NextResponse.json({ error: "Project or suggested task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update suggested task" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const taskId = searchParams.get("taskId");

    if (!projectId || !taskId) {
      return NextResponse.json({ error: "projectId and taskId are required" }, { status: 400 });
    }

    const found = await deleteSuggestedTask(projectId, taskId);
    if (!found) {
      return NextResponse.json({ error: "Project or suggested task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete suggested task" }, { status: 500 });
  }
}
