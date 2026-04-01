import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import {
  getScheduledEvents,
  addScheduledEvent,
  updateScheduledEvent,
  deleteScheduledEvent,
} from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  requireEnum,
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_SCHEDULE_TYPE,
  VALID_SCHEDULE_STATUS,
} from "@/lib/validation";
import type { ScheduledEvent } from "@/lib/types";

export async function GET() {
  try {
    const events = await getScheduledEvents();
    return NextResponse.json({ events });
  } catch (err) {
    logError("GET /api/calendar", err);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, cronExpression, linkedTaskId } = body;

    const nameResult = requireString(body.name, "name", { maxLength: 200 });
    const scheduleTypeResult = requireEnum(body.scheduleType, "scheduleType", VALID_SCHEDULE_TYPE);
    const scheduleResult = requireString(body.schedule, "schedule");

    const errors = collectErrors(nameResult, scheduleTypeResult, scheduleResult);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const now = new Date().toISOString();
    const event: ScheduledEvent = {
      id: generateId(),
      name: nameResult as string,
      description: description || "",
      scheduleType: scheduleTypeResult as ScheduledEvent["scheduleType"],
      schedule: scheduleResult as string,
      cronExpression: cronExpression || undefined,
      status: "active",
      createdAt: now,
      updatedAt: now,
      linkedTaskId: linkedTaskId || undefined,
    };

    await addScheduledEvent(event);
    return NextResponse.json({ success: true, event });
  } catch (err) {
    logError("POST /api/calendar", err);
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

    if (updates.status !== undefined) {
      const statusResult = optionalEnum(updates.status, "status", VALID_SCHEDULE_STATUS, updates.status);
      const errors = collectErrors(statusResult);
      const vRes = validationResponse(errors);
      if (vRes) return vRes;
    }

    const found = await updateScheduledEvent(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PUT /api/calendar", err);
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

    const found = await deleteScheduledEvent(id);
    if (!found) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/calendar", err);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
