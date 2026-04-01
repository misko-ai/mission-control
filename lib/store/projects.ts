import { getData, saveData } from "../db";
import type { Project } from "../types";

export async function getProjects(): Promise<Project[]> {
  const data = await getData();
  return data.projects;
}

export async function addProject(project: Project): Promise<void> {
  const data = await getData();
  data.projects.push(project);
  await saveData(data);
}

export async function updateProject(
  id: string,
  updates: Partial<Project>
): Promise<boolean> {
  const data = await getData();
  const idx = data.projects.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  data.projects[idx] = { ...data.projects[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveData(data);
  return true;
}

export async function deleteProject(id: string): Promise<boolean> {
  const data = await getData();
  const len = data.projects.length;
  data.projects = data.projects.filter((p) => p.id !== id);
  if (data.projects.length === len) return false;
  await saveData(data);
  return true;
}
