import { promises as fs } from "fs";
import path from "path";

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Parameter[];
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
}

export interface Parameter {
  name: string;
  type: "string" | "number" | "boolean" | "json";
  description: string;
  required: boolean;
}

export interface ActivityEntry {
  id: string;
  toolId: string;
  toolName: string;
  action: "created" | "executed" | "updated" | "deleted";
  details: string;
  timestamp: string;
}

export type TaskColumn = "backlog" | "in-progress" | "review" | "done";
export type TaskAssignee = "user" | "agent";

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: TaskAssignee;
  column: TaskColumn;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TaskActivityEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  action: "created" | "moved" | "picked-up" | "completed" | "approved";
  fromColumn?: TaskColumn;
  toColumn?: TaskColumn;
  actor: "user" | "agent";
  details: string;
  timestamp: string;
}

export type ScheduleType = "recurring" | "one-time";
export type ScheduleStatus = "active" | "paused" | "completed" | "failed";

export interface ScheduledEvent {
  id: string;
  name: string;
  description: string;
  scheduleType: ScheduleType;
  schedule: string;
  cronExpression?: string;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  linkedTaskId?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "completed" | "archived";
  linkedTaskIds: string[];
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
}

export interface ConversationMemory {
  id: string;
  date: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type LongTermMemoryCategory = "preference" | "decision" | "fact" | "context" | "other";

export interface LongTermMemory {
  id: string;
  title: string;
  content: string;
  category: LongTermMemoryCategory;
  createdAt: string;
  updatedAt: string;
}

export type DocCategory = "planning" | "newsletter" | "technical" | "research" | "draft" | "other";
export type DocFormat = "markdown" | "plain text" | "structured";

export interface Doc {
  id: string;
  title: string;
  content: string;
  category: DocCategory;
  format: DocFormat;
  createdAt: string;
  updatedAt: string;
}

export type AgentRole = "orchestrator" | "worker" | "specialist";
export type AgentStatus = "running" | "idle" | "offline";

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  model: string;
  parentId: string | null;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeamConfig {
  missionStatement: string;
  agents: Agent[];
}

export type BugSeverity = "low" | "medium" | "high" | "critical";
export type BugStatus = "open" | "in-progress" | "resolved";

export interface BugNote {
  id: string;
  content: string;
  author: "user" | "agent";
  createdAt: string;
}

export interface BugReport {
  id: string;
  title: string;
  screen: string;
  severity: BugSeverity;
  status: BugStatus;
  stepsToReproduce: string;
  notes: BugNote[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  theme: "light";
  autoSave: boolean;
  logLevel: "verbose" | "normal";
}

export interface AppData {
  tools: Tool[];
  activities: ActivityEntry[];
  settings: AppSettings;
  tasks: Task[];
  taskActivities: TaskActivityEntry[];
  scheduledEvents: ScheduledEvent[];
  projects: Project[];
  conversationMemories: ConversationMemory[];
  longTermMemories: LongTermMemory[];
  docs: Doc[];
  team: TeamConfig;
  bugs: BugReport[];
}

const DATA_FILE = path.join(process.cwd(), "data", "store.json");

const defaultData: AppData = {
  tools: [],
  activities: [],
  settings: {
    theme: "light",
    autoSave: true,
    logLevel: "normal",
  },
  tasks: [],
  taskActivities: [],
  scheduledEvents: [],
  projects: [],
  conversationMemories: [],
  longTermMemories: [],
  docs: [],
  team: { missionStatement: "", agents: [] },
  bugs: [],
};

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

export async function getData(): Promise<AppData> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const data = JSON.parse(raw);
  data.tasks ??= [];
  data.taskActivities ??= [];
  data.scheduledEvents ??= [];
  data.projects ??= [];
  data.conversationMemories ??= [];
  data.longTermMemories ??= [];
  data.docs ??= [];
  data.team ??= { missionStatement: "", agents: [] };
  data.team.agents ??= [];
  data.bugs ??= [];
  return data;
}

export async function saveData(data: AppData): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function addTool(tool: Tool): Promise<void> {
  const data = await getData();
  data.tools.push(tool);
  await saveData(data);
}

export async function updateTool(id: string, updates: Partial<Tool>): Promise<void> {
  const data = await getData();
  const idx = data.tools.findIndex((t) => t.id === id);
  if (idx !== -1) {
    data.tools[idx] = { ...data.tools[idx], ...updates };
    await saveData(data);
  }
}

export async function deleteTool(id: string): Promise<void> {
  const data = await getData();
  data.tools = data.tools.filter((t) => t.id !== id);
  await saveData(data);
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

export async function getSettings(): Promise<AppSettings> {
  const data = await getData();
  return data.settings;
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<void> {
  const data = await getData();
  data.settings = { ...data.settings, ...settings };
  await saveData(data);
}

// Task helpers

export async function getTasks(): Promise<Task[]> {
  const data = await getData();
  return data.tasks;
}

export async function addTask(task: Task): Promise<void> {
  const data = await getData();
  data.tasks.push(task);
  await saveData(data);
}

export async function deleteTask(id: string): Promise<void> {
  const data = await getData();
  data.tasks = data.tasks.filter((t) => t.id !== id);
  await saveData(data);
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

// Scheduled event helpers

export async function getScheduledEvents(): Promise<ScheduledEvent[]> {
  const data = await getData();
  return data.scheduledEvents;
}

export async function addScheduledEvent(event: ScheduledEvent): Promise<void> {
  const data = await getData();
  data.scheduledEvents.push(event);
  await saveData(data);
}

export async function updateScheduledEvent(
  id: string,
  updates: Partial<ScheduledEvent>
): Promise<void> {
  const data = await getData();
  const idx = data.scheduledEvents.findIndex((e) => e.id === id);
  if (idx !== -1) {
    data.scheduledEvents[idx] = { ...data.scheduledEvents[idx], ...updates };
    await saveData(data);
  }
}

export async function deleteScheduledEvent(id: string): Promise<void> {
  const data = await getData();
  data.scheduledEvents = data.scheduledEvents.filter((e) => e.id !== id);
  await saveData(data);
}

// Project helpers

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
): Promise<void> {
  const data = await getData();
  const idx = data.projects.findIndex((p) => p.id === id);
  if (idx !== -1) {
    data.projects[idx] = { ...data.projects[idx], ...updates };
    await saveData(data);
  }
}

export async function deleteProject(id: string): Promise<void> {
  const data = await getData();
  data.projects = data.projects.filter((p) => p.id !== id);
  await saveData(data);
}

// Conversation memory helpers

export async function getConversationMemories(): Promise<ConversationMemory[]> {
  const data = await getData();
  return data.conversationMemories;
}

export async function addConversationMemory(memory: ConversationMemory): Promise<void> {
  const data = await getData();
  data.conversationMemories.push(memory);
  await saveData(data);
}

export async function updateConversationMemory(
  id: string,
  updates: Partial<ConversationMemory>
): Promise<void> {
  const data = await getData();
  const idx = data.conversationMemories.findIndex((m) => m.id === id);
  if (idx !== -1) {
    data.conversationMemories[idx] = { ...data.conversationMemories[idx], ...updates };
    await saveData(data);
  }
}

export async function deleteConversationMemory(id: string): Promise<void> {
  const data = await getData();
  data.conversationMemories = data.conversationMemories.filter((m) => m.id !== id);
  await saveData(data);
}

// Long-term memory helpers

export async function getLongTermMemories(): Promise<LongTermMemory[]> {
  const data = await getData();
  return data.longTermMemories;
}

export async function addLongTermMemory(memory: LongTermMemory): Promise<void> {
  const data = await getData();
  data.longTermMemories.push(memory);
  await saveData(data);
}

export async function updateLongTermMemory(
  id: string,
  updates: Partial<LongTermMemory>
): Promise<void> {
  const data = await getData();
  const idx = data.longTermMemories.findIndex((m) => m.id === id);
  if (idx !== -1) {
    data.longTermMemories[idx] = { ...data.longTermMemories[idx], ...updates };
    await saveData(data);
  }
}

export async function deleteLongTermMemory(id: string): Promise<void> {
  const data = await getData();
  data.longTermMemories = data.longTermMemories.filter((m) => m.id !== id);
  await saveData(data);
}

// Doc helpers

export async function getDocs(): Promise<Doc[]> {
  const data = await getData();
  return data.docs;
}

export async function addDoc(doc: Doc): Promise<void> {
  const data = await getData();
  data.docs.push(doc);
  await saveData(data);
}

export async function updateDoc(
  id: string,
  updates: Partial<Doc>
): Promise<void> {
  const data = await getData();
  const idx = data.docs.findIndex((d) => d.id === id);
  if (idx !== -1) {
    data.docs[idx] = { ...data.docs[idx], ...updates };
    await saveData(data);
  }
}

export async function deleteDoc(id: string): Promise<void> {
  const data = await getData();
  data.docs = data.docs.filter((d) => d.id !== id);
  await saveData(data);
}

// Team helpers

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
): Promise<void> {
  const data = await getData();
  const idx = data.team.agents.findIndex((a) => a.id === id);
  if (idx !== -1) {
    data.team.agents[idx] = { ...data.team.agents[idx], ...updates };
    await saveData(data);
  }
}

export async function deleteAgent(id: string): Promise<void> {
  const data = await getData();
  // Also unparent any children
  data.team.agents = data.team.agents
    .filter((a) => a.id !== id)
    .map((a) => (a.parentId === id ? { ...a, parentId: null } : a));
  await saveData(data);
}
