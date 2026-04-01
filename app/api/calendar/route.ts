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
  optionalString,
  collectErrors,
  validationResponse,
  VALID_SCHEDULE_TYPE,
  VALID_SCHEDULE_STATUS,
  VALID_EVENT_TYPE,
  VALID_EVENT_OWNER,
  VALID_EVENT_PRIORITY,
  VALID_EVENT_OUTCOME,
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
    const { description, cronExpression, linkedTaskId, linkedCronId, linkedDocId } = body;

    const nameResult = requireString(body.name, "name", { maxLength: 200 });
    const scheduleTypeResult = requireEnum(body.scheduleType, "scheduleType", VALID_SCHEDULE_TYPE);
    const scheduleResult = requireString(body.schedule, "schedule");
    const eventTypeResult = optionalEnum(body.eventType, "eventType", VALID_EVENT_TYPE, "automation");
    const ownerResult = optionalEnum(body.owner, "owner", VALID_EVENT_OWNER, "user");
    const priorityResult = optionalEnum(body.priority, "priority", VALID_EVENT_PRIORITY, "medium");
    const statusResult = optionalEnum(body.status, "status", VALID_SCHEDULE_STATUS, "active");
    const lastOutcomeResult = optionalString(body.lastOutcome, "lastOutcome");
    const dueDateResult = optionalString(body.dueDate, "dueDate");

    const errors = collectErrors(
      nameResult, scheduleTypeResult, scheduleResult,
      eventTypeResult, ownerResult, priorityResult, statusResult,
      lastOutcomeResult, dueDateResult
    );
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
      status: statusResult as ScheduledEvent["status"],
      createdAt: now,
      updatedAt: now,
      linkedTaskId: linkedTaskId || undefined,
      eventType: eventTypeResult as ScheduledEvent["eventType"],
      owner: ownerResult as ScheduledEvent["owner"],
      priority: priorityResult as ScheduledEvent["priority"],
      dueDate: (dueDateResult as string) || undefined,
      linkedCronId: linkedCronId || undefined,
      linkedDocId: linkedDocId || undefined,
      lastOutcome: undefined,
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

    const validations: unknown[] = [];

    if (updates.status !== undefined) {
      validations.push(optionalEnum(updates.status, "status", VALID_SCHEDULE_STATUS, updates.status));
    }
    if (updates.eventType !== undefined) {
      validations.push(optionalEnum(updates.eventType, "eventType", VALID_EVENT_TYPE, updates.eventType));
    }
    if (updates.owner !== undefined) {
      validations.push(optionalEnum(updates.owner, "owner", VALID_EVENT_OWNER, updates.owner));
    }
    if (updates.priority !== undefined) {
      validations.push(optionalEnum(updates.priority, "priority", VALID_EVENT_PRIORITY, updates.priority));
    }
    if (updates.lastOutcome !== undefined) {
      validations.push(optionalEnum(updates.lastOutcome, "lastOutcome", VALID_EVENT_OUTCOME, updates.lastOutcome));
    }
    if (updates.name !== undefined) {
      validations.push(requireString(updates.name, "name", { maxLength: 200 }));
    }

    const errors = collectErrors(...validations);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

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
