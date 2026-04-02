// Shared type definitions for Mission Control

// --- Tools ---

export interface Parameter {
  name: string;
  type: "string" | "number" | "boolean" | "json";
  description: string;
  required: boolean;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Parameter[];
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
}

// --- Activity ---

export interface ActivityEntry {
  id: string;
  toolId: string;
  toolName: string;
  action: "created" | "executed" | "updated" | "deleted";
  details: string;
  timestamp: string;
}

// --- Tasks ---

export type TaskColumn = "backlog" | "in-progress" | "review" | "done" | "blocked";
export type TaskAssignee = "user" | "agent";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: TaskAssignee;
  column: TaskColumn;
  priority: TaskPriority;
  blockReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  currentRunId?: string;
  runCount?: number;
}

// --- Task Runs (lifecycle tracking) ---

export type RunStatus = "active" | "success" | "failure" | "timeout" | "cancelled";

export type ReasonCode =
  | "success"
  | "failure"
  | "cancelled"
  | "timeout-heartbeat"
  | "timeout-orphan"
  | "timeout-legacy"
  | "deleted"
  | "emergency-override";

export interface TaskRun {
  id: string;
  taskId: string;
  agentId: string;
  attempt: number;
  status: RunStatus;
  claimedAt: string;
  heartbeatAt: string;
  finishedAt?: string;
  terminalReason?: string;
  reasonCode?: ReasonCode;
  durationMs?: number;
  linkedBugIds?: string[];
  linkedProjectIds?: string[];
  linkedDocIds?: string[];
}

export interface TaskActivityEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  action: "created" | "moved" | "picked-up" | "completed" | "approved" | "reconciled";
  fromColumn?: TaskColumn;
  toColumn?: TaskColumn;
  actor: "user" | "agent" | "system";
  details: string;
  timestamp: string;
  runId?: string;
  agentId?: string;
  attempt?: number;
  reasonCode?: ReasonCode;
  linkedBugIds?: string[];
  linkedProjectIds?: string[];
  linkedDocIds?: string[];
}

// --- Calendar ---

export type ScheduleType = "recurring" | "one-time";
export type ScheduleStatus = "active" | "paused" | "completed" | "failed" | "draft";
export type EventType = "automation" | "reminder" | "deadline" | "review";
export type EventOwner = "user" | "agent";
export type EventPriority = "low" | "medium" | "high";
export type EventOutcome = "ok" | "failed" | "skipped";

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
  eventType?: EventType;
  owner?: EventOwner;
  priority?: EventPriority;
  dueDate?: string;
  linkedCronId?: string;
  linkedDocId?: string;
  lastOutcome?: EventOutcome;
}

// --- Projects ---

export type ProjectStatus = "idea" | "planned" | "active" | "blocked" | "completed" | "archived" | "canceled";
export type ProjectPriority = "low" | "medium" | "high" | "critical";
export type ProjectType = "idea" | "initiative" | "maintenance" | "automation" | "research" | "product" | "other";
export type ProjectOwner = "user" | "agent" | "shared";
export type PlanningState = "not-started" | "in-progress" | "ready";
export type ExecutionMode = "manual" | "assistive" | "autonomous-with-review";
export type MilestoneStatus = "pending" | "in-progress" | "completed";
export type SuggestedTaskStatus = "proposed" | "accepted" | "rejected";

export interface Milestone {
  id: string;
  title: string;
  status: MilestoneStatus;
  dueDate?: string;
}

export interface SuggestedTask {
  id: string;
  title: string;
  description: string;
  status: SuggestedTaskStatus;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  linkedTaskIds: string[];
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  // v2 strategic fields
  goal?: string;
  desiredOutcome?: string;
  successCriteria?: string[];
  constraints?: string[];
  assumptions?: string[];
  priority?: ProjectPriority;
  type?: ProjectType;
  owner?: ProjectOwner;
  planningState?: PlanningState;
  // v2 cross-linking
  linkedDocIds?: string[];
  linkedMemoryIds?: string[];
  linkedCalendarEventIds?: string[];
  linkedBugIds?: string[];
  // v2 execution
  milestones?: Milestone[];
  suggestedTasks?: SuggestedTask[];
  planningNotes?: string;
  executionMode?: ExecutionMode;
  // v2 timing
  dueDate?: string;
  nextReviewAt?: string;
  lastReviewedAt?: string;
}

// --- Memories ---

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

// --- Docs ---

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

// --- Team ---

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

// --- Bugs ---

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

// --- Settings ---

export interface AppSettings {
  theme: "light" | "dark";
  autoSave: boolean;
  logLevel: "verbose" | "normal";
}

// --- App Data (root store shape) ---

export interface AppData {
  tools: Tool[];
  activities: ActivityEntry[];
  settings: AppSettings;
  tasks: Task[];
  taskActivities: TaskActivityEntry[];
  taskRuns: TaskRun[];
  scheduledEvents: ScheduledEvent[];
  projects: Project[];
  conversationMemories: ConversationMemory[];
  longTermMemories: LongTermMemory[];
  docs: Doc[];
  team: TeamConfig;
  bugs: BugReport[];
}
