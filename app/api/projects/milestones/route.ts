import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import {
  addProjectMilestone,
  updateProjectMilestone,
  deleteProjectMilestone,
} from "@/lib/store";
import {
  requireString,
  requireEnum,
  optionalString,
  collectErrors,
  validationResponse,
  VALID_MILESTONE_STATUS,
} from "@/lib/validation";
import type { Milestone } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const title = requireString(body.title, "title", { maxLength: 200 });
    const errors = collectErrors(title);
    const resp = validationResponse(errors);
    if (resp) return resp;

    const milestone: Milestone = {
      id: generateId(),
      title: title as string,
      status: "pending",
      dueDate: body.dueDate || undefined,
    };

    const found = await addProjectMilestone(body.projectId, milestone);
    if (!found) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, milestone });
  } catch {
    return NextResponse.json({ error: "Failed to add milestone" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, milestoneId, ...updates } = body;

    if (!projectId || !milestoneId) {
      return NextResponse.json({ error: "projectId and milestoneId are required" }, { status: 400 });
    }

    const validations: unknown[] = [];
    if (updates.title !== undefined) {
      validations.push(requireString(updates.title, "title", { maxLength: 200 }));
    }
    if (updates.status !== undefined) {
      validations.push(requireEnum(updates.status, "status", VALID_MILESTONE_STATUS));
    }
    if (updates.dueDate !== undefined) {
      validations.push(optionalString(updates.dueDate, "dueDate"));
    }

    const errors = collectErrors(...validations);
    const resp = validationResponse(errors);
    if (resp) return resp;

    const found = await updateProjectMilestone(projectId, milestoneId, updates);
    if (!found) {
      return NextResponse.json({ error: "Project or milestone not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const milestoneId = searchParams.get("milestoneId");

    if (!projectId || !milestoneId) {
      return NextResponse.json({ error: "projectId and milestoneId are required" }, { status: 400 });
    }

    const found = await deleteProjectMilestone(projectId, milestoneId);
    if (!found) {
      return NextResponse.json({ error: "Project or milestone not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }
}
