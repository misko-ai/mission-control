import { getData, saveData } from "../db";
import type { Tool, ActivityEntry } from "../types";

export async function addTool(tool: Tool): Promise<void> {
  const data = await getData();
  data.tools.push(tool);
  await saveData(data);
}

export async function updateTool(id: string, updates: Partial<Tool>): Promise<boolean> {
  const data = await getData();
  const idx = data.tools.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  data.tools[idx] = { ...data.tools[idx], ...updates };
  await saveData(data);
  return true;
}

export async function deleteTool(id: string): Promise<boolean> {
  const data = await getData();
  const len = data.tools.length;
  data.tools = data.tools.filter((t) => t.id !== id);
  if (data.tools.length === len) return false;
  await saveData(data);
  return true;
}

export async function logActivity(entry: ActivityEntry): Promise<void> {
  const data = await getData();
  data.activities.unshift(entry);
  data.activities = data.activities.slice(0, 100);
  await saveData(data);
}

export async function getActivities(): Promise<ActivityEntry[]> {
  const data = await getData();
  return data.activities;
}
