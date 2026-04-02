import { NextRequest, NextResponse } from "next/server";
import { getProjects, updateProject } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const { projectId, bugId } = await request.json();

    if (!projectId || !bugId) {
      return NextResponse.json({ error: "projectId and bugId are required" }, { status: 400 });
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const linkedBugIds = project.linkedBugIds || [];
    if (linkedBugIds.includes(bugId)) {
      return NextResponse.json({ success: true });
    }

    const now = new Date().toISOString();
    await updateProject(projectId, {
      linkedBugIds: [...linkedBugIds, bugId],
      lastActiveAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to link bug" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const bugId = searchParams.get("bugId");

    if (!projectId || !bugId) {
      return NextResponse.json({ error: "projectId and bugId are required" }, { status: 400 });
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    await updateProject(projectId, {
      linkedBugIds: (project.linkedBugIds || []).filter((id) => id !== bugId),
      lastActiveAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to unlink bug" }, { status: 500 });
  }
}
