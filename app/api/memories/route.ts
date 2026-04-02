import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import {
  getConversationMemories,
  addConversationMemory,
  updateConversationMemory,
  deleteConversationMemory,
  getLongTermMemories,
  addLongTermMemory,
  updateLongTermMemory,
  deleteLongTermMemory,
} from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_MEMORY_CATEGORY,
} from "@/lib/validation";
import type { ConversationMemory, LongTermMemory } from "@/lib/types";

const VALID_TYPES = ["conversation", "longterm"] as const;
type MemoryType = (typeof VALID_TYPES)[number];

function isValidType(v: unknown): v is MemoryType {
  return typeof v === "string" && (VALID_TYPES as readonly string[]).includes(v);
}

function typeError() {
  return NextResponse.json(
    { error: "type is required and must be one of: conversation, longterm" },
    { status: 400 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type");

    if (type !== null && !isValidType(type)) {
      return typeError();
    }

    if (type === "conversation") {
      const memories = await getConversationMemories();
      return NextResponse.json({ memories });
    }
    if (type === "longterm") {
      const memories = await getLongTermMemories();
      return NextResponse.json({ memories });
    }

    const [conversationMemories, longTermMemories] = await Promise.all([
      getConversationMemories(),
      getLongTermMemories(),
    ]);
    return NextResponse.json({
      memories: [...conversationMemories, ...longTermMemories],
      conversationMemories,
      longTermMemories,
    });
  } catch (err) {
    logError("GET /api/memories", err);
    return NextResponse.json({ error: "Failed to load memories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    if (!isValidType(type)) return typeError();

    if (type === "conversation") {
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
    }

    // longterm
    const { title, content, category } = body;

    const vTitle = requireString(title, "title", { maxLength: 200 });
    const vContent = requireString(content, "content", { maxLength: 10000 });
    const vCategory = optionalEnum(category, "category", VALID_MEMORY_CATEGORY, "other");
    const errors = collectErrors(vTitle, vContent, vCategory);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const now = new Date().toISOString();
    const memory: LongTermMemory = {
      id: generateId(),
      title: vTitle as string,
      content: vContent as string,
      category: vCategory as LongTermMemory["category"],
      createdAt: now,
      updatedAt: now,
    };

    await addLongTermMemory(memory);
    return NextResponse.json({ success: true, memory });
  } catch (err) {
    logError("POST /api/memories", err);
    return NextResponse.json({ error: "Failed to create memory" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id, ...updates } = body;

    if (!isValidType(type)) return typeError();
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    if (type === "longterm" && updates.category !== undefined) {
      const vCat = optionalEnum(updates.category, "category", VALID_MEMORY_CATEGORY, updates.category);
      const errors = collectErrors(vCat);
      const vRes = validationResponse(errors);
      if (vRes) return vRes;
    }

    const found = type === "conversation"
      ? await updateConversationMemory(id, updates)
      : await updateLongTermMemory(id, updates);

    if (!found) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PUT /api/memories", err);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!isValidType(type)) return typeError();
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const found = type === "conversation"
      ? await deleteConversationMemory(id)
      : await deleteLongTermMemory(id);

    if (!found) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/memories", err);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
