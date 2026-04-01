import { NextRequest, NextResponse } from "next/server";
import { getAgents, addAgent, updateAgent, deleteAgent, Agent } from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function GET() {
  try {
    const agents = await getAgents();
    return NextResponse.json({ agents });
  } catch {
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

    if (!name || !role) {
      return NextResponse.json(
        { error: "Name and role are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const agent: Agent = {
      id: generateId(),
      name,
      role,
      description: description || "",
      model: model || "",
      parentId: parentId || null,
      status: status || "idle",
      createdAt: now,
      updatedAt: now,
    };

    await addAgent(agent);
    return NextResponse.json({ success: true, agent });
  } catch {
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

    updates.updatedAt = new Date().toISOString();
    await updateAgent(id, updates);
    return NextResponse.json({ success: true });
  } catch {
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

    await deleteAgent(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
