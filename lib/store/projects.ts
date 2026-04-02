import { getData, saveData } from "../db";
import type { Project, Milestone, SuggestedTask } from "../types";

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

// --- Milestones ---

export async function addProjectMilestone(projectId: string, milestone: Milestone): Promise<boolean> {
  const data = await getData();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return false;
  if (!project.milestones) project.milestones = [];
  project.milestones.push(milestone);
  project.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

export async function updateProjectMilestone(
  projectId: string,
  milestoneId: string,
  updates: Partial<Milestone>
): Promise<boolean> {
  const data = await getData();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project || !project.milestones) return false;
  const idx = project.milestones.findIndex((m) => m.id === milestoneId);
  if (idx === -1) return false;
  project.milestones[idx] = { ...project.milestones[idx], ...updates };
  project.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

export async function deleteProjectMilestone(projectId: string, milestoneId: string): Promise<boolean> {
  const data = await getData();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project || !project.milestones) return false;
  const len = project.milestones.length;
  project.milestones = project.milestones.filter((m) => m.id !== milestoneId);
  if (project.milestones.length === len) return false;
  project.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

// --- Suggested Tasks ---

export async function addSuggestedTask(projectId: string, task: SuggestedTask): Promise<boolean> {
  const data = await getData();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return false;
  if (!project.suggestedTasks) project.suggestedTasks = [];
  project.suggestedTasks.push(task);
  project.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

export async function updateSuggestedTask(
  projectId: string,
  taskId: string,
  updates: Partial<SuggestedTask>
): Promise<boolean> {
  const data = await getData();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project || !project.suggestedTasks) return false;
  const idx = project.suggestedTasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return false;
  project.suggestedTasks[idx] = { ...project.suggestedTasks[idx], ...updates };
  project.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

export async function deleteSuggestedTask(projectId: string, taskId: string): Promise<boolean> {
  const data = await getData();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project || !project.suggestedTasks) return false;
  const len = project.suggestedTasks.length;
  project.suggestedTasks = project.suggestedTasks.filter((t) => t.id !== taskId);
  if (project.suggestedTasks.length === len) return false;
  project.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}
