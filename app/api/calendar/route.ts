import { NextRequest, NextResponse } from "next/server";
import {
  getScheduledEvents,
  addScheduledEvent,
  updateScheduledEvent,
  deleteScheduledEvent,
  ScheduledEvent,
} from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function GET() {
  try {
    const events = await getScheduledEvents();
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, scheduleType, schedule, cronExpression, linkedTaskId } = body;

    if (!name || !scheduleType || !schedule) {
      return NextResponse.json(
        { error: "Name, scheduleType, and schedule are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const event: ScheduledEvent = {
      id: generateId(),
      name,
      description: description || "",
      scheduleType,
      schedule,
      cronExpression: cronExpression || undefined,
      status: "active",
      createdAt: now,
      updatedAt: now,
      linkedTaskId: linkedTaskId || undefined,
    };

    await addScheduledEvent(event);
    return NextResponse.json({ success: true, event });
  } catch {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    updates.updatedAt = new Date().toISOString();
    await updateScheduledEvent(id, updates);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await deleteScheduledEvent(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
