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
