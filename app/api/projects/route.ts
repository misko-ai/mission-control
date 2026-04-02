import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/db";
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  getTasks,
  getDocs,
  getBugs,
  getLongTermMemories,
  getConversationMemories,
  getScheduledEvents,
} from "@/lib/store";
import { logError } from "@/lib/logger";
import {
  requireString,
  requireEnum,
  optionalEnum,
  optionalString,
  optionalStringArray,
  collectErrors,
  validationResponse,
  VALID_PROJECT_STATUS,
  VALID_PROJECT_PRIORITY,
  VALID_PROJECT_TYPE,
  VALID_PROJECT_OWNER,
  VALID_PLANNING_STATE,
  VALID_EXECUTION_MODE,
} from "@/lib/validation";
import type { Project } from "@/lib/types";

export async function GET() {
  try {
    const [projects, tasks, docs, bugs, convMemories, ltMemories, events] = await Promise.all([
      getProjects(),
      getTasks(),
      getDocs(),
      getBugs(),
      getConversationMemories(),
      getLongTermMemories(),
      getScheduledEvents(),
    ]);

    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const docMap = new Map(docs.map((d) => [d.id, d]));
    const bugMap = new Map(bugs.map((b) => [b.id, b]));
    const memoryMap = new Map<string, { id: string; title: string }>();
    for (const m of convMemories) memoryMap.set(m.id, m);
    for (const m of ltMemories) memoryMap.set(m.id, m);
    const eventMap = new Map(events.map((e) => [e.id, e]));

    const enriched = projects.map((p) => {
      const validTaskIds = p.linkedTaskIds.filter((id) => taskMap.has(id));
      const linkedTasks = validTaskIds.map((id) => taskMap.get(id)!);
      const done = linkedTasks.filter((t) => t.column === "done").length;
      const total = linkedTasks.length;

      const validDocIds = (p.linkedDocIds || []).filter((id) => docMap.has(id));
      const linkedDocs = validDocIds.map((id) => docMap.get(id)!);

      const validBugIds = (p.linkedBugIds || []).filter((id) => bugMap.has(id));
      const linkedBugs = validBugIds.map((id) => bugMap.get(id)!);

      const validMemoryIds = (p.linkedMemoryIds || []).filter((id) => memoryMap.has(id));
      const linkedMemories = validMemoryIds.map((id) => memoryMap.get(id)!);

      const validEventIds = (p.linkedCalendarEventIds || []).filter((id) => eventMap.has(id));
      const linkedCalendarEvents = validEventIds.map((id) => eventMap.get(id)!);

      // Milestone progress
      const milestones = p.milestones || [];
      const completedMilestones = milestones.filter((m) => m.status === "completed").length;

      return {
        ...p,
        linkedTaskIds: validTaskIds,
        linkedDocIds: validDocIds,
        linkedBugIds: validBugIds,
        linkedMemoryIds: validMemoryIds,
        linkedCalendarEventIds: validEventIds,
        progress: {
          total,
          done,
          percent: total > 0 ? Math.round((done / total) * 100) : 0,
          milestoneTotal: milestones.length,
          milestoneCompleted: completedMilestones,
        },
        linkedTasks,
        linkedDocs,
        linkedBugs,
        linkedMemories,
        linkedCalendarEvents,
      };
    });

    return NextResponse.json({ projects: enriched });
  } catch (err) {
    logError("GET /api/projects", err);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = requireString(body.name, "name", { maxLength: 200 });
    const goal = optionalString(body.goal, "goal", { maxLength: 20000 });
    const desiredOutcome = optionalString(body.desiredOutcome, "desiredOutcome", { maxLength: 20000 });
    const planningNotes = optionalString(body.planningNotes, "planningNotes", { maxLength: 100000 });
    const description = optionalString(body.description, "description", { maxLength: 40000 });
    const status = optionalEnum(body.status, "status", VALID_PROJECT_STATUS, "idea");
    const priority = optionalEnum(body.priority, "priority", VALID_PROJECT_PRIORITY, "medium");
    const type = optionalEnum(body.type, "type", VALID_PROJECT_TYPE, "other");
    const owner = optionalEnum(body.owner, "owner", VALID_PROJECT_OWNER, "user");
    const planningState = optionalEnum(body.planningState, "planningState", VALID_PLANNING_STATE, "not-started");
    const executionMode = optionalEnum(body.executionMode, "executionMode", VALID_EXECUTION_MODE, "manual");
    const successCriteria = optionalStringArray(body.successCriteria, "successCriteria", { maxItems: 50, maxItemLength: 2000 });
    const constraints = optionalStringArray(body.constraints, "constraints", { maxItems: 50, maxItemLength: 2000 });
    const assumptions = optionalStringArray(body.assumptions, "assumptions", { maxItems: 50, maxItemLength: 2000 });

    const errors = collectErrors(
      name, goal, desiredOutcome, planningNotes, description,
      status, priority, type, owner, planningState, executionMode,
      successCriteria, constraints, assumptions
    );
    const resp = validationResponse(errors);
    if (resp) return resp;

    const now = new Date().toISOString();
    const project: Project = {
      id: generateId(),
      name: name as string,
      description: (description as string) || "",
      status: status as Project["status"],
      linkedTaskIds: body.linkedTaskIds || [],
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      goal: (goal as string) || "",
      desiredOutcome: (desiredOutcome as string) || "",
      successCriteria: (successCriteria as string[]) || [],
      constraints: (constraints as string[]) || [],
      assumptions: (assumptions as string[]) || [],
      priority: priority as Project["priority"],
      type: type as Project["type"],
      owner: owner as Project["owner"],
      planningState: planningState as Project["planningState"],
      linkedDocIds: [],
      linkedMemoryIds: [],
      linkedCalendarEventIds: [],
      linkedBugIds: [],
      milestones: [],
      suggestedTasks: [],
      planningNotes: (planningNotes as string) || "",
      executionMode: executionMode as Project["executionMode"],
      dueDate: body.dueDate || undefined,
      nextReviewAt: body.nextReviewAt || undefined,
    };

    await addProject(project);
    return NextResponse.json({ success: true, project });
  } catch (err) {
    logError("POST /api/projects", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const validations: unknown[] = [];

    if (updates.status !== undefined) {
      validations.push(requireEnum(updates.status, "status", VALID_PROJECT_STATUS));
    }
    if (updates.name !== undefined) {
      validations.push(requireString(updates.name, "name", { maxLength: 200 }));
    }
    if (updates.priority !== undefined) {
      validations.push(requireEnum(updates.priority, "priority", VALID_PROJECT_PRIORITY));
    }
    if (updates.type !== undefined) {
      validations.push(requireEnum(updates.type, "type", VALID_PROJECT_TYPE));
    }
    if (updates.owner !== undefined) {
      validations.push(requireEnum(updates.owner, "owner", VALID_PROJECT_OWNER));
    }
    if (updates.planningState !== undefined) {
      validations.push(requireEnum(updates.planningState, "planningState", VALID_PLANNING_STATE));
    }
    if (updates.executionMode !== undefined) {
      validations.push(requireEnum(updates.executionMode, "executionMode", VALID_EXECUTION_MODE));
    }
    if (updates.goal !== undefined) {
      validations.push(optionalString(updates.goal, "goal", { maxLength: 20000 }));
    }
    if (updates.desiredOutcome !== undefined) {
      validations.push(optionalString(updates.desiredOutcome, "desiredOutcome", { maxLength: 20000 }));
    }
    if (updates.planningNotes !== undefined) {
      validations.push(optionalString(updates.planningNotes, "planningNotes", { maxLength: 100000 }));
    }
    if (updates.successCriteria !== undefined) {
      validations.push(optionalStringArray(updates.successCriteria, "successCriteria", { maxItems: 50, maxItemLength: 2000 }));
    }
    if (updates.constraints !== undefined) {
      validations.push(optionalStringArray(updates.constraints, "constraints", { maxItems: 50, maxItemLength: 2000 }));
    }
    if (updates.assumptions !== undefined) {
      validations.push(optionalStringArray(updates.assumptions, "assumptions", { maxItems: 50, maxItemLength: 2000 }));
    }

    const errors = collectErrors(...validations);
    const resp = validationResponse(errors);
    if (resp) return resp;

    const found = await updateProject(id, updates);
    if (!found) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("PUT /api/projects", err);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const found = await deleteProject(id);
    if (!found) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logError("DELETE /api/projects", err);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
