import { NextRequest, NextResponse } from "next/server";
import { getDocs, updateDoc } from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_DOC_CATEGORY,
  VALID_DOC_FORMAT,
} from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const docs = await getDocs();
    const doc = docs.find((d) => d.id === id);
    if (!doc) {
      return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    }
    return NextResponse.json({ doc });
  } catch (err) {
    logError("GET /api/docs/[id]", err);
    return NextResponse.json(
      { error: "Failed to load doc" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { title, content, category, format } = body;

    const checks: unknown[] = [];
    if (category !== undefined) {
      checks.push(optionalEnum(category, "category", VALID_DOC_CATEGORY, category));
    }
    if (format !== undefined) {
      checks.push(optionalEnum(format, "format", VALID_DOC_FORMAT, format));
    }
    const errors = collectErrors(...checks);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (category !== undefined) updates.category = category;
    if (format !== undefined) updates.format = format;

    const found = await updateDoc(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    }

    const docs = await getDocs();
    const doc = docs.find((d) => d.id === id);
    return NextResponse.json({ success: true, doc });
  } catch (err) {
    logError("PUT /api/docs/[id]", err);
    return NextResponse.json(
      { error: "Failed to update doc" },
      { status: 500 }
    );
  }
}
