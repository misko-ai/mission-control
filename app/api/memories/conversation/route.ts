import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import {
  getConversationMemories,
  addConversationMemory,
  updateConversationMemory,
  deleteConversationMemory,
} from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  collectErrors,
  validationResponse,
} from "@/lib/validation";
import type { ConversationMemory } from "@/lib/types";

export async function GET() {
  try {
    const memories = await getConversationMemories();
    return NextResponse.json({ memories });
  } catch (err) {
    logError("GET /api/memories/conversation", err);
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

    const vTitle = requireString(title, "title", { maxLength: 200 });
    const vContent = requireString(content, "content", { maxLength: 10000 });

    const errors = collectErrors(vTitle, vContent);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const now = new Date().toISOString();
    const memory: ConversationMemory = {
      id: generateId(),
      date: date || now.split("T")[0],
      title: vTitle as string,
      content: vContent as string,
      tags: tags || [],
      createdAt: now,
      updatedAt: now,
    };

    await addConversationMemory(memory);
    return NextResponse.json({ success: true, memory });
  } catch (err) {
    logError("POST /api/memories/conversation", err);
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

    const found = await updateConversationMemory(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Conversation memory not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PUT /api/memories/conversation", err);
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

    const found = await deleteConversationMemory(id);
    if (!found) {
      return NextResponse.json({ error: "Conversation memory not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/memories/conversation", err);
    return NextResponse.json(
      { error: "Failed to delete conversation memory" },
      { status: 500 }
    );
  }
}
