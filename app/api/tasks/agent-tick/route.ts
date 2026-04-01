import { NextResponse } from "next/server";
import { getTasks, moveTask, logTaskActivity, TaskActivityEntry } from "@/lib/store";

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export async function POST() {
  try {
    const tasks = await getTasks();
    const agentTasks = tasks
      .filter((t) => t.assignee === "agent")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Priority 1: Pick up oldest backlog task
    const backlogTask = agentTasks.find((t) => t.column === "backlog");
    if (backlogTask) {
      await moveTask(backlogTask.id, "in-progress");
      const activity: TaskActivityEntry = {
        id: generateId(),
        taskId: backlogTask.id,
        taskTitle: backlogTask.title,
        action: "picked-up",
        fromColumn: "backlog",
        toColumn: "in-progress",
        actor: "agent",
        details: `Agent picked up "${backlogTask.title}"`,
        timestamp: new Date().toISOString(),
      };
      await logTaskActivity(activity);
      return NextResponse.json({ processed: true, task: backlogTask, action: "picked-up" });
    }

    // Priority 2: Complete oldest in-progress task
    const inProgressTask = agentTasks.find((t) => t.column === "in-progress");
    if (inProgressTask) {
      await moveTask(inProgressTask.id, "review");
      const activity: TaskActivityEntry = {
        id: generateId(),
        taskId: inProgressTask.id,
        taskTitle: inProgressTask.title,
        action: "completed",
        fromColumn: "in-progress",
        toColumn: "review",
        actor: "agent",
        details: `Agent completed "${inProgressTask.title}", awaiting review`,
        timestamp: new Date().toISOString(),
      };
      await logTaskActivity(activity);
      return NextResponse.json({ processed: true, task: inProgressTask, action: "completed" });
    }

    return NextResponse.json({ processed: false });
  } catch {
    return NextResponse.json({ error: "Agent tick failed" }, { status: 500 });
  }
}
