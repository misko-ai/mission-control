import { NextRequest, NextResponse } from "next/server";
import {
  getLongTermMemories,
  addLongTermMemory,
  updateLongTermMemory,
  deleteLongTermMemory,
  LongTermMemory,
} from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function GET() {
  try {
    const memories = await getLongTermMemories();
    return NextResponse.json({ memories });
  } catch {
    return NextResponse.json(
      { error: "Failed to load long-term memories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, category } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const memory: LongTermMemory = {
      id: generateId(),
      title,
      content,
      category: category || "other",
      createdAt: now,
      updatedAt: now,
    };

    await addLongTermMemory(memory);
    return NextResponse.json({ success: true, memory });
  } catch {
    return NextResponse.json(
      { error: "Failed to create long-term memory" },
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
    await updateLongTermMemory(id, updates);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update long-term memory" },
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

    await deleteLongTermMemory(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete long-term memory" },
      { status: 500 }
    );
  }
}
