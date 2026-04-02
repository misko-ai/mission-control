import { NextRequest, NextResponse } from "next/server";
import { getProjects, updateProject } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const { projectId, docId } = await request.json();

    if (!projectId || !docId) {
      return NextResponse.json({ error: "projectId and docId are required" }, { status: 400 });
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const linkedDocIds = project.linkedDocIds || [];
    if (linkedDocIds.includes(docId)) {
      return NextResponse.json({ success: true });
    }

    const now = new Date().toISOString();
    await updateProject(projectId, {
      linkedDocIds: [...linkedDocIds, docId],
      lastActiveAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to link doc" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const docId = searchParams.get("docId");

    if (!projectId || !docId) {
      return NextResponse.json({ error: "projectId and docId are required" }, { status: 400 });
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    await updateProject(projectId, {
      linkedDocIds: (project.linkedDocIds || []).filter((id) => id !== docId),
      lastActiveAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to unlink doc" }, { status: 500 });
  }
}
