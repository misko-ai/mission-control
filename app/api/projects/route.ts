import { NextRequest, NextResponse } from "next/server";
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  getTasks,
  Project,
} from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

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
  } catch {
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, linkedTaskIds } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const project: Project = {
      id: generateId(),
      name,
      description: description || "",
      status: "active",
      linkedTaskIds: linkedTaskIds || [],
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
    };

    await addProject(project);
    return NextResponse.json({ success: true, project });
  } catch {
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

    const now = new Date().toISOString();
    updates.updatedAt = now;
    updates.lastActiveAt = now;
    await updateProject(id, updates);
    return NextResponse.json({ success: true });
  } catch {
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

    await deleteProject(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
