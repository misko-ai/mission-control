"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  Task,
  TaskColumn,
  ProjectStatus,
  ProjectPriority,
  ProjectType,
  ProjectOwner,
  Milestone,
  SuggestedTask,
  Doc,
  BugReport,
  ScheduledEvent,
} from "@/lib/types";
import MilestoneList from "@/components/projects/MilestoneList";
import EntityLinker from "@/components/projects/EntityLinker";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/fetch";

// --- Badge maps ---

const statusBadge: Record<ProjectStatus, string> = {
  idea: "bg-accent/15 text-accent",
  planned: "bg-[#a78bfa]/15 text-[#a78bfa]",
  active: "bg-success/15 text-success",
  blocked: "bg-danger/15 text-danger",
  completed: "bg-success/15 text-success",
  archived: "bg-text-muted/15 text-text-muted",
  canceled: "bg-text-muted/15 text-text-muted",
};

const priorityBadge: Record<ProjectPriority, string> = {
  low: "bg-text-muted/15 text-text-muted",
  medium: "bg-accent/15 text-accent",
  high: "bg-warning/15 text-warning",
  critical: "bg-danger/15 text-danger",
};

const typeBadge: Record<ProjectType, string> = {
  idea: "bg-accent/15 text-accent",
  initiative: "bg-[#a78bfa]/15 text-[#a78bfa]",
  maintenance: "bg-text-muted/15 text-text-muted",
  automation: "bg-success/15 text-success",
  research: "bg-warning/15 text-warning",
  product: "bg-accent/15 text-accent",
  other: "bg-surface-hover text-text-muted",
};

const columnColor: Record<TaskColumn, string> = {
  backlog: "bg-text-muted/15 text-text-muted",
  "in-progress": "bg-accent/15 text-accent",
  blocked: "bg-danger/15 text-danger",
  review: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success",
};

const columnLabel: Record<TaskColumn, string> = {
  backlog: "Backlog",
  "in-progress": "In Progress",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};

const suggestedStatusBadge: Record<string, string> = {
  proposed: "bg-accent/15 text-accent",
  accepted: "bg-success/15 text-success",
  rejected: "bg-text-muted/15 text-text-muted",
};

// --- Types ---

interface ProjectProgress {
  total: number;
  done: number;
  percent: number;
  milestoneTotal: number;
  milestoneCompleted: number;
}

interface ProjectWithProgress {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  linkedTaskIds: string[];
  linkedTasks: Task[];
  progress: ProjectProgress;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  goal: string;
  desiredOutcome: string;
  successCriteria: string[];
  constraints: string[];
  assumptions: string[];
  priority: ProjectPriority;
  type: ProjectType;
  owner: ProjectOwner;
  planningState: string;
  linkedDocIds: string[];
  linkedMemoryIds: string[];
  linkedCalendarEventIds: string[];
  linkedBugIds: string[];
  linkedDocs: Doc[];
  linkedBugs: BugReport[];
  linkedMemories: { id: string; title: string }[];
  linkedCalendarEvents: ScheduledEvent[];
  milestones: Milestone[];
  suggestedTasks: SuggestedTask[];
  planningNotes: string;
  executionMode: string;
  dueDate?: string;
  nextReviewAt?: string;
  lastReviewedAt?: string;
}

type StatusFilter = "all" | ProjectStatus;

// --- Helpers ---

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// --- Page ---

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formGoal, setFormGoal] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<ProjectType>("other");
  const [formPriority, setFormPriority] = useState<ProjectPriority>("medium");
  const [formOwner, setFormOwner] = useState<ProjectOwner>("user");
  const [formDueDate, setFormDueDate] = useState("");
  const [formError, setFormError] = useState("");

  // Edit state
  const [editError, setEditError] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editDesiredOutcome, setEditDesiredOutcome] = useState("");
  const [editPlanningNotes, setEditPlanningNotes] = useState("");
  const [editPriority, setEditPriority] = useState<ProjectPriority>("medium");
  const [editType, setEditType] = useState<ProjectType>("other");
  const [editOwner, setEditOwner] = useState<ProjectOwner>("user");
  const [editExecutionMode, setEditExecutionMode] = useState("manual");

  // String array editors
  const [editSuccessCriteria, setEditSuccessCriteria] = useState<string[]>([]);
  const [editConstraints, setEditConstraints] = useState<string[]>([]);
  const [editAssumptions, setEditAssumptions] = useState<string[]>([]);
  const [newCriterion, setNewCriterion] = useState("");
  const [newConstraint, setNewConstraint] = useState("");
  const [newAssumption, setNewAssumption] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/tasks"),
      ]);
      const projData = await projRes.json();
      const taskData = await taskRes.json();
      setProjects(projData.projects || []);
      setAllTasks(taskData.tasks || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (linkingTaskId && searchRef.current) {
      searchRef.current.focus();
    }
  }, [linkingTaskId]);

  // --- Actions ---

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!formName) return;
    setFormError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        description: formDesc,
        goal: formGoal,
        type: formType,
        priority: formPriority,
        owner: formOwner,
        dueDate: formDueDate || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to create project" }));
      const msg = data.fields?.map((f: { field: string; message: string }) => f.message).join(", ") || data.error || "Failed to create project";
      setFormError(msg);
      return;
    }
    setFormName(""); setFormGoal(""); setFormDesc(""); setFormType("other");
    setFormPriority("medium"); setFormOwner("user"); setFormDueDate("");
    setShowForm(false);
    fetchData();
  }

  async function saveEdit(id: string) {
    setEditError("");
    const res = await fetch("/api/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: editName,
        description: editDesc,
        goal: editGoal,
        desiredOutcome: editDesiredOutcome,
        planningNotes: editPlanningNotes,
        priority: editPriority,
        type: editType,
        owner: editOwner,
        executionMode: editExecutionMode,
        successCriteria: editSuccessCriteria,
        constraints: editConstraints,
        assumptions: editAssumptions,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to save" }));
      const msg = data.fields?.map((f: { field: string; message: string }) => f.message).join(", ") || data.error || "Failed to save";
      setEditError(msg);
      return;
    }
    setEditingId(null);
    fetchData();
  }

  async function setProjectStatus(id: string, status: ProjectStatus) {
    const result = await apiFetch("/api/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!result.ok) { toast(result.error, "error"); }
    fetchData();
  }

  async function deleteProject(id: string) {
    const result = await apiFetch(`/api/projects?id=${id}`, { method: "DELETE" });
    if (!result.ok) { toast(result.error, "error"); return; }
    setConfirmDelete(null);
    if (expandedId === id) setExpandedId(null);
    fetchData();
  }

  async function linkTask(projectId: string, taskId: string) {
    const result = await apiFetch("/api/projects/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, taskId }),
    });
    if (!result.ok) { toast(result.error, "error"); return; }
    setTaskSearch("");
    fetchData();
  }

  async function unlinkTask(projectId: string, taskId: string) {
    const result = await apiFetch(`/api/projects/tasks?projectId=${projectId}&taskId=${taskId}`, {
      method: "DELETE",
    });
    if (!result.ok) { toast(result.error, "error"); }
    fetchData();
  }

  async function updateSuggestedTaskStatus(projectId: string, taskId: string, status: string) {
    const result = await apiFetch("/api/projects/suggested-tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, taskId, status }),
    });
    if (!result.ok) { toast(result.error, "error"); }
    fetchData();
  }

  function startEdit(project: ProjectWithProgress) {
    setEditingId(project.id);
    setEditName(project.name);
    setEditDesc(project.description);
    setEditGoal(project.goal || "");
    setEditDesiredOutcome(project.desiredOutcome || "");
    setEditPlanningNotes(project.planningNotes || "");
    setEditPriority(project.priority || "medium");
    setEditType(project.type || "other");
    setEditOwner(project.owner || "user");
    setEditExecutionMode(project.executionMode || "manual");
    setEditSuccessCriteria([...(project.successCriteria || [])]);
    setEditConstraints([...(project.constraints || [])]);
    setEditAssumptions([...(project.assumptions || [])]);
  }

  // --- Filtering ---

  const filtered = statusFilter === "all"
    ? projects
    : projects.filter((p) => p.status === statusFilter);

  const statusCounts: Record<StatusFilter, number> = {
    all: projects.length,
    idea: projects.filter((p) => p.status === "idea").length,
    planned: projects.filter((p) => p.status === "planned").length,
    active: projects.filter((p) => p.status === "active").length,
    blocked: projects.filter((p) => p.status === "blocked").length,
    completed: projects.filter((p) => p.status === "completed").length,
    archived: projects.filter((p) => p.status === "archived").length,
    canceled: projects.filter((p) => p.status === "canceled").length,
  };

  function getUnlinkedTasks(project: ProjectWithProgress) {
    const linked = new Set(project.linkedTaskIds);
    return allTasks.filter(
      (t) => !linked.has(t.id) && t.title.toLowerCase().includes(taskSearch.toLowerCase())
    );
  }

  // --- Status action buttons ---

  function statusActions(project: ProjectWithProgress) {
    const actions: { label: string; status: ProjectStatus; color: string }[] = [];
    switch (project.status) {
      case "idea":
        actions.push({ label: "Plan", status: "planned", color: "text-[#a78bfa] hover:bg-[#a78bfa]/10" });
        actions.push({ label: "Activate", status: "active", color: "text-success hover:bg-success/10" });
        break;
      case "planned":
        actions.push({ label: "Activate", status: "active", color: "text-success hover:bg-success/10" });
        break;
      case "active":
        actions.push({ label: "Complete", status: "completed", color: "text-success hover:bg-success/10" });
        actions.push({ label: "Block", status: "blocked", color: "text-danger hover:bg-danger/10" });
        break;
      case "blocked":
        actions.push({ label: "Unblock", status: "active", color: "text-success hover:bg-success/10" });
        break;
      case "completed":
        actions.push({ label: "Reopen", status: "active", color: "text-accent hover:bg-accent/10" });
        break;
      case "archived":
        actions.push({ label: "Restore", status: "active", color: "text-success hover:bg-success/10" });
        break;
      case "canceled":
        actions.push({ label: "Restore", status: "idea", color: "text-accent hover:bg-accent/10" });
        break;
    }
    // Archive/cancel always available for non-terminal states
    if (!["archived", "canceled"].includes(project.status)) {
      actions.push({ label: "Archive", status: "archived", color: "text-warning hover:bg-warning/10" });
      actions.push({ label: "Cancel", status: "canceled", color: "text-text-muted hover:bg-surface-hover" });
    }
    return actions;
  }

  // --- String array editor helper ---

  function StringArrayEditor({
    items, setItems, newItem, setNewItem, placeholder
  }: {
    items: string[]; setItems: (v: string[]) => void;
    newItem: string; setNewItem: (v: string) => void; placeholder: string;
  }) {
    return (
      <div>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 mb-1">
            <span className="text-xs text-text flex-1">{item}</span>
            <button
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              className="text-text-muted hover:text-danger text-xs shrink-0"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItem.trim()) {
                e.preventDefault();
                setItems([...items, newItem.trim()]);
                setNewItem("");
              }
            }}
            placeholder={placeholder}
            className="flex-1 px-2.5 py-1 text-xs bg-background border border-border rounded-md text-text"
          />
          <button
            onClick={() => { if (newItem.trim()) { setItems([...items, newItem.trim()]); setNewItem(""); } }}
            disabled={!newItem.trim()}
            className="text-xs text-accent hover:text-accent-hover disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  // --- Render ---

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text">Projects</h2>
          <p className="text-text-secondary text-sm mt-1">
            {projects.length === 0
              ? "No projects yet"
              : `${statusCounts.active} active, ${statusCounts.idea} ideas, ${statusCounts.planned} planned`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          {showForm ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={createProject}
          className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-4"
        >
          <div>
            <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wide">Name</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Project name"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wide">Goal</label>
            <input
              value={formGoal}
              onChange={(e) => setFormGoal(e.target.value)}
              placeholder="What is this project trying to achieve?"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wide">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ProjectType)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              >
                <option value="idea">Idea</option>
                <option value="initiative">Initiative</option>
                <option value="maintenance">Maintenance</option>
                <option value="automation">Automation</option>
                <option value="research">Research</option>
                <option value="product">Product</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wide">Priority</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as ProjectPriority)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wide">Owner</label>
              <select
                value={formOwner}
                onChange={(e) => setFormOwner(e.target.value as ProjectOwner)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              >
                <option value="user">User</option>
                <option value="agent">Agent</option>
                <option value="shared">Shared</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wide">Due Date</label>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="What is this project about..."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
            />
          </div>
          {formError && (
            <p className="text-xs text-danger">{formError}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!formName}
              className="px-4 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Create Project
            </button>
          </div>
        </form>
      )}

      {/* Status Filter */}
      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-lg p-1 w-fit flex-wrap">
        {(["all", "idea", "planned", "active", "blocked", "completed", "archived", "canceled"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize flex items-center gap-1.5 ${
              statusFilter === s
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text hover:bg-surface-hover"
            }`}
          >
            {s}
            {statusCounts[s] > 0 && (
              <span className={`text-xs ${statusFilter === s ? "opacity-70" : "text-text-muted"}`}>
                {statusCounts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-text-secondary text-sm">Loading projects...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="bg-surface border border-border rounded-lg hover:border-accent/30 transition-colors"
            >
              {/* Card Header — always visible */}
              <div className="p-5">
                {editingId === project.id ? (
                  /* === EDIT MODE === */
                  <div className="space-y-4">
                    {/* Overview */}
                    <h4 className="text-[10px] uppercase tracking-widest text-text-muted font-medium">Overview</h4>
                    <div className="space-y-3">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text font-medium"
                        autoFocus
                      />
                      <input
                        value={editGoal}
                        onChange={(e) => setEditGoal(e.target.value)}
                        placeholder="Goal — what is this project trying to achieve?"
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                      />
                      <input
                        value={editDesiredOutcome}
                        onChange={(e) => setEditDesiredOutcome(e.target.value)}
                        placeholder="Desired outcome — what does success look like?"
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                      />
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description"
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wide">Type</label>
                          <select value={editType} onChange={(e) => setEditType(e.target.value as ProjectType)}
                            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md text-text">
                            {["idea","initiative","maintenance","automation","research","product","other"].map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wide">Priority</label>
                          <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as ProjectPriority)}
                            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md text-text">
                            {["low","medium","high","critical"].map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wide">Owner</label>
                          <select value={editOwner} onChange={(e) => setEditOwner(e.target.value as ProjectOwner)}
                            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md text-text">
                            {["user","agent","shared"].map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wide">Execution Mode</label>
                        <select value={editExecutionMode} onChange={(e) => setEditExecutionMode(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md text-text">
                          {["manual","assistive","autonomous-with-review"].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Strategy */}
                    <h4 className="text-[10px] uppercase tracking-widest text-text-muted font-medium pt-2">Strategy</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wide">Success Criteria</label>
                        <StringArrayEditor items={editSuccessCriteria} setItems={setEditSuccessCriteria}
                          newItem={newCriterion} setNewItem={setNewCriterion} placeholder="Add criterion..." />
                      </div>
                      <div>
                        <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wide">Constraints</label>
                        <StringArrayEditor items={editConstraints} setItems={setEditConstraints}
                          newItem={newConstraint} setNewItem={setNewConstraint} placeholder="Add constraint..." />
                      </div>
                      <div>
                        <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wide">Assumptions</label>
                        <StringArrayEditor items={editAssumptions} setItems={setEditAssumptions}
                          newItem={newAssumption} setNewItem={setNewAssumption} placeholder="Add assumption..." />
                      </div>
                      <div>
                        <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wide">Planning Notes</label>
                        <textarea
                          value={editPlanningNotes}
                          onChange={(e) => setEditPlanningNotes(e.target.value)}
                          placeholder="Strategy notes, analysis, thinking..."
                          rows={3}
                          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
                        />
                      </div>
                    </div>

                    {editError && <p className="text-xs text-danger pt-2">{editError}</p>}
                    <div className="flex gap-2 justify-end pt-2">
                      <button onClick={() => { setEditingId(null); setEditError(""); }}
                        className="px-3 py-1.5 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors">Cancel</button>
                      <button onClick={() => saveEdit(project.id)} disabled={!editName}
                        className="px-3 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50">Save</button>
                    </div>
                  </div>
                ) : (
                  /* === VIEW MODE === */
                  <>
                    {/* Row 1: Name + badges + actions */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3
                            className="text-sm font-medium text-text truncate cursor-pointer hover:text-accent transition-colors"
                            onClick={() => setExpandedId(expandedId === project.id ? null : project.id)}
                          >
                            {project.name}
                          </h3>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${typeBadge[project.type]}`}>{project.type}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${statusBadge[project.status]}`}>{project.status}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${priorityBadge[project.priority]}`}>{project.priority}</span>
                        </div>
                        {project.goal && (
                          <p className="text-xs text-text-secondary line-clamp-1">{project.goal}</p>
                        )}
                        {!project.goal && project.description && (
                          <p className="text-xs text-text-secondary line-clamp-1">{project.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => startEdit(project)}
                          className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors">Edit</button>
                        {statusActions(project).slice(0, 2).map((a) => (
                          <button key={a.status} onClick={() => setProjectStatus(project.id, a.status)}
                            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${a.color}`}>{a.label}</button>
                        ))}
                        {confirmDelete === project.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => deleteProject(project.id)}
                              className="px-2.5 py-1 text-xs rounded-md bg-danger text-white hover:bg-danger/90 transition-colors">Confirm</button>
                            <button onClick={() => setConfirmDelete(null)}
                              className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(project.id)}
                            className="px-2.5 py-1 text-xs rounded-md text-danger hover:bg-danger/10 transition-colors">Delete</button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-text-secondary">Progress</span>
                        <span className="text-xs text-text-muted">
                          {project.progress.percent}%{" "}
                          {project.progress.total > 0 && <span>({project.progress.done}/{project.progress.total})</span>}
                          {project.progress.milestoneTotal > 0 && (
                            <span className="ml-2">Milestones: {project.progress.milestoneCompleted}/{project.progress.milestoneTotal}</span>
                          )}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-hover rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all duration-300"
                          style={{ width: `${project.progress.percent}%` }} />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <span>Last active {relativeTime(project.lastActiveAt)}</span>
                      {project.dueDate && <span>Due {project.dueDate}</span>}
                      {project.nextReviewAt && <span>Review {project.nextReviewAt}</span>}
                      <span>Created {relativeTime(project.createdAt)}</span>
                    </div>

                    {/* === EXPANDED DETAIL VIEW === */}
                    {expandedId === project.id && (
                      <div className="mt-4 pt-4 border-t border-border-subtle space-y-5">

                        {/* Overview Section */}
                        <div>
                          <h4 className="text-[10px] uppercase tracking-widest text-text-muted font-medium mb-2">Overview</h4>
                          <div className="space-y-1.5 text-xs">
                            {project.description && <p className="text-text-secondary">{project.description}</p>}
                            {project.goal && <p><span className="text-text-muted">Goal:</span> <span className="text-text">{project.goal}</span></p>}
                            {project.desiredOutcome && <p><span className="text-text-muted">Desired outcome:</span> <span className="text-text">{project.desiredOutcome}</span></p>}
                            <div className="flex gap-3 pt-1">
                              <span className="text-text-muted">Owner: <span className="text-text">{project.owner}</span></span>
                              <span className="text-text-muted">Mode: <span className="text-text">{project.executionMode}</span></span>
                              <span className="text-text-muted">Planning: <span className="text-text">{project.planningState}</span></span>
                            </div>
                          </div>
                        </div>

                        {/* Strategy Section */}
                        {(project.successCriteria?.length > 0 || project.constraints?.length > 0 || project.assumptions?.length > 0 || project.planningNotes) && (
                          <div>
                            <h4 className="text-[10px] uppercase tracking-widest text-text-muted font-medium mb-2">Strategy</h4>
                            <div className="space-y-2 text-xs">
                              {project.successCriteria?.length > 0 && (
                                <div>
                                  <span className="text-text-muted">Success criteria:</span>
                                  <ul className="mt-0.5 space-y-0.5">
                                    {project.successCriteria.map((c, i) => (
                                      <li key={i} className="text-text pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-accent/30 before:rounded-full">{c}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {project.constraints?.length > 0 && (
                                <div>
                                  <span className="text-text-muted">Constraints:</span>
                                  <ul className="mt-0.5 space-y-0.5">
                                    {project.constraints.map((c, i) => (
                                      <li key={i} className="text-text pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-warning/30 before:rounded-full">{c}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {project.assumptions?.length > 0 && (
                                <div>
                                  <span className="text-text-muted">Assumptions:</span>
                                  <ul className="mt-0.5 space-y-0.5">
                                    {project.assumptions.map((a, i) => (
                                      <li key={i} className="text-text pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-text-muted/30 before:rounded-full">{a}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {project.planningNotes && (
                                <div>
                                  <span className="text-text-muted">Planning notes:</span>
                                  <p className="text-text mt-0.5 whitespace-pre-wrap">{project.planningNotes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Execution Section */}
                        <div>
                          <h4 className="text-[10px] uppercase tracking-widest text-text-muted font-medium mb-2">Execution</h4>

                          {/* Milestones */}
                          <div className="mb-3">
                            <p className="text-xs text-text-secondary mb-1.5">Milestones</p>
                            <MilestoneList milestones={project.milestones || []} projectId={project.id} onRefresh={fetchData} />
                          </div>

                          {/* Linked Tasks */}
                          <div className="mb-3">
                            <p className="text-xs text-text-secondary mb-1.5">Linked tasks</p>
                            {project.linkedTasks.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {project.linkedTasks.map((task) => (
                                  <div key={task.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-background group">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${columnColor[task.column]}`}>{columnLabel[task.column]}</span>
                                      <span className="text-xs text-text truncate">{task.title}</span>
                                    </div>
                                    <button onClick={() => unlinkTask(project.id, task.id)}
                                      className="text-text-muted hover:text-danger text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {linkingTaskId === project.id ? (
                              <div>
                                <input ref={searchRef} value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)}
                                  placeholder="Search tasks to link..."
                                  className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-md text-text mb-1.5" />
                                {getUnlinkedTasks(project).length > 0 ? (
                                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                                    {getUnlinkedTasks(project).map((task) => (
                                      <button key={task.id} onClick={() => linkTask(project.id, task.id)}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left hover:bg-surface-hover transition-colors">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${columnColor[task.column]}`}>{columnLabel[task.column]}</span>
                                        <span className="text-xs text-text truncate">{task.title}</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-text-muted px-2.5 py-1.5">
                                    {allTasks.length === 0 ? "No tasks available" : "No unlinked tasks match"}
                                  </p>
                                )}
                                <button onClick={() => { setLinkingTaskId(null); setTaskSearch(""); }}
                                  className="mt-1.5 text-xs text-text-secondary hover:text-text transition-colors">Done</button>
                              </div>
                            ) : (
                              <button onClick={() => setLinkingTaskId(project.id)}
                                className="text-xs text-accent hover:text-accent-hover transition-colors">+ Link task</button>
                            )}
                          </div>

                          {/* Suggested Tasks */}
                          {(project.suggestedTasks || []).length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs text-text-secondary mb-1.5">Suggested tasks</p>
                              <div className="space-y-1">
                                {project.suggestedTasks.map((st) => (
                                  <div key={st.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-background">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${suggestedStatusBadge[st.status]}`}>{st.status}</span>
                                      <span className="text-xs text-text truncate">{st.title}</span>
                                    </div>
                                    {st.status === "proposed" && (
                                      <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <button onClick={() => updateSuggestedTaskStatus(project.id, st.id, "accepted")}
                                          className="text-[10px] px-1.5 py-0.5 rounded text-success hover:bg-success/10">Accept</button>
                                        <button onClick={() => updateSuggestedTaskStatus(project.id, st.id, "rejected")}
                                          className="text-[10px] px-1.5 py-0.5 rounded text-danger hover:bg-danger/10">Reject</button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Knowledge Section */}
                        <div>
                          <h4 className="text-[10px] uppercase tracking-widest text-text-muted font-medium mb-2">Knowledge</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-text-secondary mb-1.5">Docs</p>
                              <EntityLinker label="docs" linkedIds={project.linkedDocIds || []}
                                apiBase="/api/docs" entityIdParam="docId" projectId={project.id} onRefresh={fetchData} />
                            </div>
                            <div>
                              <p className="text-xs text-text-secondary mb-1.5">Bugs</p>
                              <EntityLinker label="bugs" linkedIds={project.linkedBugIds || []}
                                apiBase="/api/bugs" entityIdParam="bugId" projectId={project.id} onRefresh={fetchData} />
                            </div>
                            <div>
                              <p className="text-xs text-text-secondary mb-1.5">Memories</p>
                              <EntityLinker label="memories" linkedIds={project.linkedMemoryIds || []}
                                apiBase="/api/memories" entityIdParam="memoryId" projectId={project.id} onRefresh={fetchData} />
                            </div>
                            <div>
                              <p className="text-xs text-text-secondary mb-1.5">Calendar</p>
                              <EntityLinker label="calendar" linkedIds={project.linkedCalendarEventIds || []}
                                apiBase="/api/calendar" entityIdParam="eventId" projectId={project.id} onRefresh={fetchData} />
                            </div>
                          </div>
                        </div>

                        {/* Status Actions (more options in expanded view) */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                          <span className="text-xs text-text-muted">Actions:</span>
                          {statusActions(project).map((a) => (
                            <button key={a.status + a.label} onClick={() => setProjectStatus(project.id, a.status)}
                              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${a.color}`}>{a.label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-text-muted">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <p className="text-text-secondary text-sm">
            {statusFilter === "all" ? "No projects yet" : `No ${statusFilter} projects`}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {statusFilter === "all"
              ? "Create a project to start tracking your work"
              : "Try a different filter"}
          </p>
        </div>
      )}
    </div>
  );
}
