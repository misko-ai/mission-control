import { NextRequest, NextResponse } from "next/server";
import { getProjects, updateProject } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const { projectId, memoryId } = await request.json();

    if (!projectId || !memoryId) {
      return NextResponse.json({ error: "projectId and memoryId are required" }, { status: 400 });
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const linkedMemoryIds = project.linkedMemoryIds || [];
    if (linkedMemoryIds.includes(memoryId)) {
      return NextResponse.json({ success: true });
    }

    const now = new Date().toISOString();
    await updateProject(projectId, {
      linkedMemoryIds: [...linkedMemoryIds, memoryId],
      lastActiveAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to link memory" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const memoryId = searchParams.get("memoryId");

    if (!projectId || !memoryId) {
      return NextResponse.json({ error: "projectId and memoryId are required" }, { status: 400 });
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    await updateProject(projectId, {
      linkedMemoryIds: (project.linkedMemoryIds || []).filter((id) => id !== memoryId),
      lastActiveAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to unlink memory" }, { status: 500 });
  }
}
