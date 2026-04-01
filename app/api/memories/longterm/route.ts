import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import {
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
import type { LongTermMemory } from "@/lib/types";

export async function GET() {
  try {
    const memories = await getLongTermMemories();
    return NextResponse.json({ memories });
  } catch (err) {
    logError("GET /api/memories/longterm", err);
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
    logError("POST /api/memories/longterm", err);
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

    const checks: unknown[] = [];
    if (updates.category !== undefined) {
      checks.push(optionalEnum(updates.category, "category", VALID_MEMORY_CATEGORY, updates.category));
    }
    const errors = collectErrors(...checks);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const found = await updateLongTermMemory(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Long-term memory not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PUT /api/memories/longterm", err);
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

    const found = await deleteLongTermMemory(id);
    if (!found) {
      return NextResponse.json({ error: "Long-term memory not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/memories/longterm", err);
    return NextResponse.json(
      { error: "Failed to delete long-term memory" },
      { status: 500 }
    );
  }
}
