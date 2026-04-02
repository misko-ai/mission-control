import { getData, saveData } from "../db";
import type { TaskRun } from "../types";

const MAX_TASK_RUNS = 200;

export async function getTaskRuns(): Promise<TaskRun[]> {
  const data = await getData();
  return data.taskRuns;
}

export async function getTaskRunById(runId: string): Promise<TaskRun | undefined> {
  const data = await getData();
  return data.taskRuns.find((r) => r.id === runId);
}

export async function addTaskRun(run: TaskRun): Promise<void> {
  const data = await getData();
  data.taskRuns.unshift(run);
  data.taskRuns = data.taskRuns.slice(0, MAX_TASK_RUNS);
  await saveData(data);
}

export async function updateTaskRun(
  runId: string,
  updates: Partial<TaskRun>
): Promise<boolean> {
  const data = await getData();
  const idx = data.taskRuns.findIndex((r) => r.id === runId);
  if (idx === -1) return false;
  data.taskRuns[idx] = { ...data.taskRuns[idx], ...updates };
  await saveData(data);
  return true;
}

export async function linkArtifactsToRun(
  runId: string,
  artifacts: { bugIds?: string[]; projectIds?: string[]; docIds?: string[] }
): Promise<TaskRun | null> {
  const data = await getData();
  const run = data.taskRuns.find((r) => r.id === runId);
  if (!run) return null;

  if (artifacts.bugIds?.length) {
    const existing = run.linkedBugIds ?? [];
    run.linkedBugIds = [...new Set([...existing, ...artifacts.bugIds])];
  }
  if (artifacts.projectIds?.length) {
    const existing = run.linkedProjectIds ?? [];
    run.linkedProjectIds = [...new Set([...existing, ...artifacts.projectIds])];
  }
  if (artifacts.docIds?.length) {
    const existing = run.linkedDocIds ?? [];
    run.linkedDocIds = [...new Set([...existing, ...artifacts.docIds])];
  }

  await saveData(data);
  return run;
}
