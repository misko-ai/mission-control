import { NextRequest, NextResponse } from "next/server";
import { getProjects, updateProject } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const { projectId, taskId } = await request.json();

    if (!projectId || !taskId) {
      return NextResponse.json(
        { error: "projectId and taskId are required" },
        { status: 400 }
      );
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.linkedTaskIds.includes(taskId)) {
      return NextResponse.json({ success: true });
    }

    const now = new Date().toISOString();
    await updateProject(projectId, {
      linkedTaskIds: [...project.linkedTaskIds, taskId],
      lastActiveAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to link task" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const taskId = searchParams.get("taskId");

    if (!projectId || !taskId) {
      return NextResponse.json(
        { error: "projectId and taskId are required" },
        { status: 400 }
      );
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    await updateProject(projectId, {
      linkedTaskIds: project.linkedTaskIds.filter((id) => id !== taskId),
      lastActiveAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to unlink task" }, { status: 500 });
  }
}
