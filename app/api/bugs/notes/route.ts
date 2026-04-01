import { NextRequest, NextResponse } from "next/server";
import { addBugNote, BugNote } from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bugId, content, author } = body;

    if (!bugId || !content) {
      return NextResponse.json(
        { error: "Bug ID and content are required" },
        { status: 400 }
      );
    }

    const note: BugNote = {
      id: generateId(),
      content,
      author: author || "user",
      createdAt: new Date().toISOString(),
    };

    await addBugNote(bugId, note);
    return NextResponse.json({ success: true, note });
  } catch {
    return NextResponse.json(
      { error: "Failed to add note" },
      { status: 500 }
    );
  }
}
