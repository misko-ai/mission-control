import { NextRequest, NextResponse } from "next/server";
import { getBugs, addBug, updateBug, deleteBug, BugReport } from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function GET() {
  try {
    const bugs = await getBugs();
    return NextResponse.json({ bugs });
  } catch {
    return NextResponse.json(
      { error: "Failed to load bugs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, screen, severity, stepsToReproduce, status } = body;

    if (!title || !screen || !severity) {
      return NextResponse.json(
        { error: "Title, screen, and severity are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const bug: BugReport = {
      id: generateId(),
      title,
      screen,
      severity,
      status: status || "open",
      stepsToReproduce: stepsToReproduce || "",
      notes: [],
      createdAt: now,
      updatedAt: now,
    };

    await addBug(bug);
    return NextResponse.json({ success: true, bug });
  } catch {
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

    updates.updatedAt = new Date().toISOString();
    await updateBug(id, updates);
    return NextResponse.json({ success: true });
  } catch {
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

    await deleteBug(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete bug" },
      { status: 500 }
    );
  }
}
