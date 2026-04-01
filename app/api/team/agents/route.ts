import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import { getAgents, addAgent, updateAgent, deleteAgent } from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  requireEnum,
  optionalEnum,
  collectErrors,
  validationResponse,
  VALID_AGENT_ROLE,
  VALID_AGENT_STATUS,
} from "@/lib/validation";
import type { Agent } from "@/lib/types";

export async function GET() {
  try {
    const agents = await getAgents();
    return NextResponse.json({ agents });
  } catch (err) {
    logError("GET /api/team/agents", err);
    return NextResponse.json(
      { error: "Failed to load agents" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, description, model, parentId, status } = body;

    const vName = requireString(name, "name", { maxLength: 200 });
    const vRole = requireEnum(role, "role", VALID_AGENT_ROLE);
    const vStatus = optionalEnum(status, "status", VALID_AGENT_STATUS, "idle");

    const errors = collectErrors(vName, vRole, vStatus);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const now = new Date().toISOString();
    const agent: Agent = {
      id: generateId(),
      name: vName as string,
      role: vRole as Agent["role"],
      description: description || "",
      model: model || "",
      parentId: parentId || null,
      status: vStatus as Agent["status"],
      createdAt: now,
      updatedAt: now,
    };

    await addAgent(agent);
    return NextResponse.json({ success: true, agent });
  } catch (err) {
    logError("POST /api/team/agents", err);
    return NextResponse.json(
      { error: "Failed to create agent" },
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
    if (updates.role !== undefined) {
      checks.push(optionalEnum(updates.role, "role", VALID_AGENT_ROLE, updates.role));
    }
    if (updates.status !== undefined) {
      checks.push(optionalEnum(updates.status, "status", VALID_AGENT_STATUS, updates.status));
    }
    const errors = collectErrors(...checks);
    const vRes = validationResponse(errors);
    if (vRes) return vRes;

    const found = await updateAgent(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PUT /api/team/agents", err);
    return NextResponse.json(
      { error: "Failed to update agent" },
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

    const found = await deleteAgent(id);
    if (!found) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/team/agents", err);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
