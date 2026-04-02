import { NextRequest, NextResponse } from "next/server";
import { getProjects, updateProject } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const { projectId, eventId } = await request.json();

    if (!projectId || !eventId) {
      return NextResponse.json({ error: "projectId and eventId are required" }, { status: 400 });
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const linkedCalendarEventIds = project.linkedCalendarEventIds || [];
    if (linkedCalendarEventIds.includes(eventId)) {
      return NextResponse.json({ success: true });
    }

    const now = new Date().toISOString();
    await updateProject(projectId, {
      linkedCalendarEventIds: [...linkedCalendarEventIds, eventId],
      lastActiveAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to link calendar event" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const eventId = searchParams.get("eventId");

    if (!projectId || !eventId) {
      return NextResponse.json({ error: "projectId and eventId are required" }, { status: 400 });
    }

    const projects = await getProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    await updateProject(projectId, {
      linkedCalendarEventIds: (project.linkedCalendarEventIds || []).filter((id) => id !== eventId),
      lastActiveAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to unlink calendar event" }, { status: 500 });
  }
}
