import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import { getBugs, addBug, updateBug, deleteBug } from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  requireEnum,
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_BUG_SEVERITY,
  VALID_BUG_STATUS,
} from "@/lib/validation";
import type { BugReport } from "@/lib/types";

export async function GET() {
  try {
    const bugs = await getBugs();
    return NextResponse.json({ bugs });
  } catch (err) {
    logError("GET /api/bugs", err);
    return NextResponse.json(
      { error: "Failed to load bugs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stepsToReproduce, status } = body;

    const titleResult = requireString(body.title, "title", { maxLength: 200 });
    const screenResult = requireString(body.screen, "screen", { maxLength: 200 });
    const severityResult = requireEnum(body.severity, "severity", VALID_BUG_SEVERITY);

    const errors = collectErrors(titleResult, screenResult, severityResult);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const now = new Date().toISOString();
    const bug: BugReport = {
      id: generateId(),
      title: titleResult as string,
      screen: screenResult as string,
      severity: severityResult as BugReport["severity"],
      status: status || "open",
      stepsToReproduce: stepsToReproduce || "",
      notes: [],
      createdAt: now,
      updatedAt: now,
    };

    await addBug(bug);
    return NextResponse.json({ success: true, bug });
  } catch (err) {
    logError("POST /api/bugs", err);
    return NextResponse.json(
      { error: "Failed to create bug" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    if (updates.severity !== undefined) {
      const sevResult = optionalEnum(updates.severity, "severity", VALID_BUG_SEVERITY, updates.severity);
      const errors = collectErrors(sevResult);
      const vRes = validationResponse(errors);
      if (vRes) return vRes;
    }

    if (updates.status !== undefined) {
      const statusResult = optionalEnum(updates.status, "status", VALID_BUG_STATUS, updates.status);
      const errors = collectErrors(statusResult);
      const vRes = validationResponse(errors);
      if (vRes) return vRes;
    }

    const found = await updateBug(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Bug not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PUT /api/bugs", err);
    return NextResponse.json(
      { error: "Failed to update bug" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const found = await deleteBug(id);
    if (!found) {
      return NextResponse.json({ error: "Bug not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/bugs", err);
    return NextResponse.json(
      { error: "Failed to delete bug" },
      { status: 500 }
    );
  }
}
