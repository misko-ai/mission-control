import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  getTasks,
} from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  requireEnum,
  collectErrors,
  validationResponse,
  VALID_PROJECT_STATUS,
} from "@/lib/validation";
import type { Project } from "@/lib/types";

export async function GET() {
  try {
    const [projects, tasks] = await Promise.all([getProjects(), getTasks()]);
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    const enriched = projects.map((p) => {
      const validIds = p.linkedTaskIds.filter((id) => taskMap.has(id));
      const linkedTasks = validIds.map((id) => taskMap.get(id)!);
      const done = linkedTasks.filter((t) => t.column === "done").length;
      const total = linkedTasks.length;
      return {
        ...p,
        linkedTaskIds: validIds,
        progress: { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 },
        linkedTasks,
      };
    });

    return NextResponse.json({ projects: enriched });
  } catch (err) {
    logError("GET /api/projects", err);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = requireString(body.name, "name", { maxLength: 200 });

    const errors = collectErrors(name);
    const resp = validationResponse(errors);
    if (resp) return resp;

    const now = new Date().toISOString();
    const project: Project = {
      id: generateId(),
      name: name as string,
      description: body.description || "",
      status: "active",
      linkedTaskIds: body.linkedTaskIds || [],
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
    };

    await addProject(project);
    return NextResponse.json({ success: true, project });
  } catch (err) {
    logError("POST /api/projects", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    if (updates.status !== undefined) {
      const v = requireEnum(updates.status, "status", VALID_PROJECT_STATUS);
      const errors = collectErrors(v);
      const resp = validationResponse(errors);
      if (resp) return resp;
    }

    if (updates.name !== undefined) {
      const v = requireString(updates.name, "name", { maxLength: 200 });
      const errors = collectErrors(v);
      const resp = validationResponse(errors);
      if (resp) return resp;
    }

    const found = await updateProject(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PUT /api/projects", err);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const found = await deleteProject(id);
    if (!found) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/projects", err);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
