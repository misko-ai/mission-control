import { getData, saveData, generateId } from "../db";
import type { Task, TaskColumn, TaskActivityEntry } from "../types";

export async function getTasks(): Promise<Task[]> {
  const data = await getData();
  return data.tasks;
}

export async function addTask(task: Omit<Task, "id"> & { id?: string }): Promise<Task> {
  const data = await getData();
  const newTask: Task = { ...task, id: task.id || generateId() };
  data.tasks.push(newTask);
  await saveData(data);
  return newTask;
}

export async function updateTask(
  id: string,
  updates: Partial<Task>
): Promise<boolean> {
  const data = await getData();
  const idx = data.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  data.tasks[idx] = { ...data.tasks[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveData(data);
  return true;
}

export async function deleteTask(id: string): Promise<boolean> {
  const data = await getData();
  const len = data.tasks.length;
  data.tasks = data.tasks.filter((t) => t.id !== id);
  if (data.tasks.length === len) return false;
  await saveData(data);
  return true;
}

export async function moveTask(
  id: string,
  toColumn: TaskColumn
): Promise<{ task: Task; fromColumn: TaskColumn } | null> {
  const data = await getData();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return null;
  const fromColumn = task.column;
  task.column = toColumn;
  task.updatedAt = new Date().toISOString();
  if (toColumn === "done") task.completedAt = new Date().toISOString();
  await saveData(data);
  return { task, fromColumn };
}

export async function getTaskActivities(): Promise<TaskActivityEntry[]> {
  const data = await getData();
  return data.taskActivities;
}

export async function logTaskActivity(entry: TaskActivityEntry): Promise<void> {
  const data = await getData();
  data.taskActivities.unshift(entry);
  data.taskActivities = data.taskActivities.slice(0, 100);
  await saveData(data);
}
