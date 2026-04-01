import { NextRequest, NextResponse } from "next/server";
import { getData, updateTool, logActivity, ActivityEntry } from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Tool ID required" }, { status: 400 });
    }

    const data = await getData();
    const tool = data.tools.find((t) => t.id === id);

    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    await updateTool(id, {
      usageCount: tool.usageCount + 1,
      lastUsed: now,
    });

    const activity: ActivityEntry = {
      id: generateId(),
      toolId: id,
      toolName: tool.name,
      action: "executed",
      details: `Tool "${tool.name}" was executed`,
      timestamp: now,
    };
    await logActivity(activity);

    return NextResponse.json({ success: true, usageCount: tool.usageCount + 1 });
  } catch {
    return NextResponse.json({ error: "Failed to execute tool" }, { status: 500 });
  }
}
