import { NextRequest, NextResponse } from "next/server";
import {
  getData,
  addTool,
  deleteTool,
  updateTool,
  logActivity,
  updateSettings,
  Tool,
  ActivityEntry,
} from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function GET() {
  try {
    const data = await getData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, parameters } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: "Name and description required" },
        { status: 400 }
      );
    }

    const tool: Tool = {
      id: generateId(),
      name,
      description,
      parameters: parameters || [],
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };

    await addTool(tool);

    const activity: ActivityEntry = {
      id: generateId(),
      toolId: tool.id,
      toolName: tool.name,
      action: "created",
      details: `Tool "${tool.name}" was created`,
      timestamp: new Date().toISOString(),
    };
    await logActivity(activity);

    return NextResponse.json({ success: true, tool });
  } catch {
    return NextResponse.json({ error: "Failed to create tool" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, parameters } = body;

    if (!id) {
      return NextResponse.json({ error: "Tool ID required" }, { status: 400 });
    }

    const data = await getData();
    const existingTool = data.tools.find((t) => t.id === id);
    if (!existingTool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    const updates: Partial<Tool> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (parameters !== undefined) updates.parameters = parameters;

    await updateTool(id, updates);

    const updatedName = updates.name ?? existingTool.name;
    const activity: ActivityEntry = {
      id: generateId(),
      toolId: id,
      toolName: updatedName,
      action: "updated",
      details: `Tool "${updatedName}" was updated`,
      timestamp: new Date().toISOString(),
    };
    await logActivity(activity);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update tool" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const data = await getData();
    const tool = data.tools.find((t) => t.id === id);

    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    const activity: ActivityEntry = {
      id: generateId(),
      toolId: id,
      toolName: tool.name,
      action: "deleted",
      details: `Tool "${tool.name}" was deleted`,
      timestamp: new Date().toISOString(),
    };
    await logActivity(activity);
    await deleteTool(id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete tool" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (settings) {
      await updateSettings(settings);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
