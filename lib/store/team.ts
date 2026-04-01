import { getData, saveData } from "../db";
import type { TeamConfig, Agent } from "../types";

export async function getTeam(): Promise<TeamConfig> {
  const data = await getData();
  return data.team;
}

export async function updateMissionStatement(mission: string): Promise<void> {
  const data = await getData();
  data.team.missionStatement = mission;
  await saveData(data);
}

export async function getAgents(): Promise<Agent[]> {
  const data = await getData();
  return data.team.agents;
}

export async function addAgent(agent: Agent): Promise<void> {
  const data = await getData();
  data.team.agents.push(agent);
  await saveData(data);
}

export async function updateAgent(
  id: string,
  updates: Partial<Agent>
): Promise<boolean> {
  const data = await getData();
  const idx = data.team.agents.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  data.team.agents[idx] = { ...data.team.agents[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveData(data);
  return true;
}

export async function deleteAgent(id: string): Promise<boolean> {
  const data = await getData();
  const len = data.team.agents.length;
  data.team.agents = data.team.agents
    .filter((a) => a.id !== id)
    .map((a) => (a.parentId === id ? { ...a, parentId: null } : a));
  if (data.team.agents.length === len) return false;
  await saveData(data);
  return true;
}
