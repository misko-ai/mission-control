import { NextRequest, NextResponse } from "next/server";
import {
  getConversationMemories,
  addConversationMemory,
  updateConversationMemory,
  deleteConversationMemory,
  ConversationMemory,
} from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function GET() {
  try {
    const memories = await getConversationMemories();
    return NextResponse.json({ memories });
  } catch {
    return NextResponse.json(
      { error: "Failed to load conversation memories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, title, content, tags } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const memory: ConversationMemory = {
      id: generateId(),
      date: date || now.split("T")[0],
      title,
      content,
      tags: tags || [],
      createdAt: now,
      updatedAt: now,
    };

    await addConversationMemory(memory);
    return NextResponse.json({ success: true, memory });
  } catch {
    return NextResponse.json(
      { error: "Failed to create conversation memory" },
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
    await updateConversationMemory(id, updates);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update conversation memory" },
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

    await deleteConversationMemory(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete conversation memory" },
      { status: 500 }
    );
  }
}
