import { NextRequest, NextResponse } from "next/server";
import { getDocs, addDoc, updateDoc, deleteDoc, Doc } from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function GET() {
  try {
    const docs = await getDocs();
    return NextResponse.json({ docs });
  } catch {
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

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const doc: Doc = {
      id: generateId(),
      title,
      content,
      category: category || "other",
      format: format || "plain text",
      createdAt: now,
      updatedAt: now,
    };

    await addDoc(doc);
    return NextResponse.json({ success: true, doc });
  } catch {
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

    updates.updatedAt = new Date().toISOString();
    await updateDoc(id, updates);
    return NextResponse.json({ success: true });
  } catch {
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

    await deleteDoc(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete doc" },
      { status: 500 }
    );
  }
}
