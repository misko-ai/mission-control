import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import { getDocs, addDoc, updateDoc, deleteDoc } from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_DOC_CATEGORY,
  VALID_DOC_FORMAT,
} from "@/lib/validation";
import type { Doc } from "@/lib/types";

export async function GET() {
  try {
    const docs = await getDocs();
    return NextResponse.json({ docs });
  } catch (err) {
    logError("GET /api/docs", err);
    return NextResponse.json(
      { error: "Failed to load docs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, category, format } = body;

    const vTitle = requireString(title, "title", { maxLength: 200 });
    const vContent = requireString(content, "content", { maxLength: 10000 });
    const vCategory = optionalEnum(category, "category", VALID_DOC_CATEGORY, "other");
    const vFormat = optionalEnum(format, "format", VALID_DOC_FORMAT, "plain text");

    const errors = collectErrors(vTitle, vContent, vCategory, vFormat);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const now = new Date().toISOString();
    const doc: Doc = {
      id: generateId(),
      title: vTitle as string,
      content: vContent as string,
      category: vCategory as Doc["category"],
      format: vFormat as Doc["format"],
      createdAt: now,
      updatedAt: now,
    };

    await addDoc(doc);
    return NextResponse.json({ success: true, doc });
  } catch (err) {
    logError("POST /api/docs", err);
    return NextResponse.json(
      { error: "Failed to create doc" },
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
      checks.push(optionalEnum(updates.category, "category", VALID_DOC_CATEGORY, updates.category));
    }
    if (updates.format !== undefined) {
      checks.push(optionalEnum(updates.format, "format", VALID_DOC_FORMAT, updates.format));
    }
    const errors = collectErrors(...checks);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const found = await updateDoc(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PUT /api/docs", err);
    return NextResponse.json(
      { error: "Failed to update doc" },
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

    const found = await deleteDoc(id);
    if (!found) {
      return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/docs", err);
    return NextResponse.json(
      { error: "Failed to delete doc" },
      { status: 500 }
    );
  }
}
