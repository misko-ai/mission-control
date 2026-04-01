import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import {
  getData,
  addTool,
  deleteTool,
  updateTool,
  logActivity,
  updateSettings,
} from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_THEME,
  VALID_LOG_LEVEL,
} from "@/lib/validation";
import type { Tool, ActivityEntry } from "@/lib/types";

export async function GET() {
  try {
    const data = await getData();
    return NextResponse.json({ tools: data.tools });
  } catch (err) {
    logError("GET /api/tools", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, parameters } = body;

    const vName = requireString(name, "name", { maxLength: 200 });
    const vDescription = requireString(description, "description", { maxLength: 10000 });

    const errors = collectErrors(vName, vDescription);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const tool: Tool = {
      id: generateId(),
      name: vName as string,
      description: vDescription as string,
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
  } catch (err) {
    logError("POST /api/tools", err);
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

    const found = await updateTool(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

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
  } catch (err) {
    logError("PUT /api/tools", err);
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

    const found = await deleteTool(id);
    if (!found) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/tools", err);
    return NextResponse.json({ error: "Failed to delete tool" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (settings) {
      const checks: unknown[] = [];
      if (settings.theme !== undefined) {
        checks.push(optionalEnum(settings.theme, "theme", VALID_THEME, settings.theme));
      }
      if (settings.logLevel !== undefined) {
        checks.push(optionalEnum(settings.logLevel, "logLevel", VALID_LOG_LEVEL, settings.logLevel));
      }
      const errors = collectErrors(...checks);
      const vRes = validationResponse(errors);
      if (vRes) return vRes;

      await updateSettings(settings);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PATCH /api/tools", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
