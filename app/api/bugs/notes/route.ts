import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import { addBugNote } from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_NOTE_AUTHOR,
} from "@/lib/validation";
import type { BugNote } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const bugIdResult = requireString(body.bugId, "bugId");
    const contentResult = requireString(body.content, "content", { maxLength: 5000 });
    const authorResult = optionalEnum(body.author, "author", VALID_NOTE_AUTHOR, "user");

    const errors = collectErrors(bugIdResult, contentResult, authorResult);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const note: BugNote = {
      id: generateId(),
      content: contentResult as string,
      author: authorResult as BugNote["author"],
      createdAt: new Date().toISOString(),
    };

    const found = await addBugNote(bugIdResult as string, note);
    if (!found) {
      return NextResponse.json({ error: "Bug not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, note });
  } catch (err) {
    logError("POST /api/bugs/notes", err);
    return NextResponse.json(
      { error: "Failed to add note" },
      { status: 500 }
    );
  }
}
