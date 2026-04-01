import { getData, saveData } from "../db";
import type { BugReport, BugNote } from "../types";

export async function getBugs(): Promise<BugReport[]> {
  const data = await getData();
  return data.bugs;
}

export async function addBug(bug: BugReport): Promise<void> {
  const data = await getData();
  data.bugs.unshift(bug);
  await saveData(data);
}

export async function updateBug(
  id: string,
  updates: Partial<BugReport>
): Promise<boolean> {
  const data = await getData();
  const idx = data.bugs.findIndex((b) => b.id === id);
  if (idx === -1) return false;
  data.bugs[idx] = { ...data.bugs[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveData(data);
  return true;
}

export async function deleteBug(id: string): Promise<boolean> {
  const data = await getData();
  const len = data.bugs.length;
  data.bugs = data.bugs.filter((b) => b.id !== id);
  if (data.bugs.length === len) return false;
  await saveData(data);
  return true;
}

export async function addBugNote(
  bugId: string,
  note: BugNote
): Promise<boolean> {
  const data = await getData();
  const bug = data.bugs.find((b) => b.id === bugId);
  if (!bug) return false;
  bug.notes.push(note);
  bug.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}
