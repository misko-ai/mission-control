"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type TaskColumn = "backlog" | "in-progress" | "blocked" | "review" | "done";
type TaskAssignee = "user" | "agent";

interface Task {
  id: string;
  title: string;
  description: string;
  assignee: TaskAssignee;
  column: TaskColumn;
  createdAt: string;
  updatedAt: string;
  blockReason?: string;
  completedAt?: string;
}

interface TaskActivityEntry {
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

const columns: { key: TaskColumn; label: string; borderClass: string; bgClass: string }[] = [
  { key: "backlog", label: "Backlog", borderClass: "border-t-text-muted", bgClass: "bg-surface-hover" },
  { key: "in-progress", label: "In Progress", borderClass: "border-t-accent", bgClass: "bg-accent\/10" },
  { key: "blocked", label: "Blocked", borderClass: "border-t-danger", bgClass: "bg-danger\/10" },
  { key: "review", label: "Review", borderClass: "border-t-warning", bgClass: "bg-warning\/10" },
  { key: "done", label: "Done", borderClass: "border-t-success", bgClass: "bg-success\/10" },
];

const columnLabels: Record<TaskColumn, string> = {
  backlog: "Backlog",
  "in-progress": "In Progress",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TaskboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<TaskActivityEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<TaskColumn | null>(null);
  const [moveMenuTaskId, setMoveMenuTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAssignee, setFormAssignee] = useState<TaskAssignee>("user");

  const feedRef = useRef<HTMLDivElement>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch { /* ignore */ }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/activities");
      const data = await res.json();
      setActivities(data.activities || []);
    } catch { /* ignore */ }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
    fetchActivities();
  }, [fetchTasks, fetchActivities]);

  // Activity polling (3s)
  useEffect(() => {
    const interval = setInterval(fetchActivities, 3000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim()) return;

    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formTitle.trim(),
        description: formDescription.trim(),
        assignee: formAssignee,
      }),
    });

    setFormTitle("");
    setFormDescription("");
    setFormAssignee("user");
    setShowForm(false);
    fetchTasks();
    fetchActivities();
  }

  async function handleMoveTask(taskId: string, toColumn: TaskColumn) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, column: toColumn } : t))
    );
    setMoveMenuTaskId(null);

    await fetch("/api/tasks/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, toColumn, actor: "user" }),
    });

    fetchTasks();
    fetchActivities();
  }

  async function handleApprove(taskId: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, column: "done" as TaskColumn } : t))
    );

    await fetch("/api/tasks/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });

    fetchTasks();
    fetchActivities();
  }

  async function handleUpdateTask(taskId: string, updates: Partial<Task>) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
    setEditingTaskId(null);
    await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, ...updates }),
    });
    fetchTasks();
  }

  async function handleDeleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/tasks?id=${taskId}`, { method: "DELETE" });
    fetchTasks();
  }

  // Drag and drop
  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, toColumn: TaskColumn) {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.column === toColumn) return;
    handleMoveTask(taskId, toColumn);
  }

  return (
    <div className="flex h-full">
      {/* Activity Feed Panel */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-surface">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text">Activity</h3>
          <p className="text-xs text-text-muted mt-1">Task activity feed</p>
        </div>
        <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {activities.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-8">No activity yet</p>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="p-2.5 rounded-md bg-background text-xs">
                <div className="flex items-start gap-2">
                  <ActivityDot action={a.action} actor={a.actor} />
                  <div className="flex-1 min-w-0">
                    <p className="text-text leading-relaxed">{a.details}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`font-medium ${a.actor === "agent" ? "text-success" : "text-accent"}`}>
                        {a.actor === "agent" ? "AI Agent" : "User"}
                      </span>
                      <span className="text-text-muted">{formatRelativeTime(a.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Board */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-text">Taskboard</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              {tasks.filter((t) => t.column !== "done").length} active tasks
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-sm rounded-md hover:bg-accent-hover transition-colors"
          >
            <PlusIcon />
            New Task
          </button>
        </div>

        {/* New Task Form */}
        {showForm && (
          <div className="mx-6 mb-4 p-5 bg-surface border border-border rounded-lg shrink-0">
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Task title"
                  className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md text-text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What needs to be done?"
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-md text-text resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Assignee</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="assignee"
                      value="user"
                      checked={formAssignee === "user"}
                      onChange={() => setFormAssignee("user")}
                      className="accent-[var(--accent)]"
                    />
                    User
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="assignee"
                      value="agent"
                      checked={formAssignee === "agent"}
                      onChange={() => setFormAssignee("agent")}
                      className="accent-[var(--accent)]"
                    />
                    AI Agent
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-accent text-white text-sm rounded-md hover:bg-accent-hover transition-colors"
                >
                  Create Task
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 bg-surface-hover text-text-secondary text-sm rounded-md hover:bg-surface-active transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Kanban Columns */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 pb-6">
          <div className="flex gap-4 h-full min-w-0">
            {columns.map((col) => {
              const colTasks = tasks.filter((t) => t.column === col.key);
              const isDragOver = dragOverColumn === col.key;

              return (
                <div
                  key={col.key}
                  className={`flex-1 min-w-[220px] flex flex-col rounded-lg border-t-2 ${col.borderClass} ${
                    isDragOver ? "ring-2 ring-accent\/20 bg-accent\/10" : ""
                  }`}
                  onDragOver={handleDragOver}
                  onDragEnter={() => setDragOverColumn(col.key)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverColumn(null);
                    }
                  }}
                  onDrop={(e) => handleDrop(e, col.key)}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text uppercase tracking-wide">
                        {col.label}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${col.bgClass} text-text-secondary`}>
                        {colTasks.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                    {colTasks.length === 0 ? (
                      <div className="flex items-center justify-center h-20 text-xs text-text-muted border border-dashed border-border rounded-md">
                        {isDragOver ? "Drop here" : "No tasks"}
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onDragStart={handleDragStart}
                          onMove={handleMoveTask}
                          onApprove={handleApprove}
                          onDelete={handleDeleteTask}
                          onUpdate={handleUpdateTask}
                          isEditing={editingTaskId === task.id}
                          onToggleEdit={(id) =>
                            setEditingTaskId(editingTaskId === id ? null : id)
                          }
                          moveMenuOpen={moveMenuTaskId === task.id}
                          onToggleMoveMenu={(id) =>
                            setMoveMenuTaskId(moveMenuTaskId === id ? null : id)
                          }
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onDragStart,
  onMove,
  onApprove,
  onDelete,
  onUpdate,
  isEditing,
  onToggleEdit,
  moveMenuOpen,
  onToggleMoveMenu,
}: {
  task: Task;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onMove: (id: string, col: TaskColumn) => void;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  isEditing: boolean;
  onToggleEdit: (id: string) => void;
  moveMenuOpen: boolean;
  onToggleMoveMenu: (id: string) => void;
}) {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description);
  const [editAssignee, setEditAssignee] = useState<TaskAssignee>(task.assignee);

  const isDone = task.column === "done";
  const isBlocked = task.column === "blocked";
  const isReview = task.column === "review";
  const availableColumns = (["backlog", "in-progress", "blocked", "review", "done"] as TaskColumn[]).filter(
    (c) => c !== task.column
  );

  if (isEditing) {
    return (
      <div className="bg-surface border border-accent/30 rounded-md p-3 space-y-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Title</label>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-background border border-border rounded text-text"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Description</label>
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={2}
            className="w-full px-2 py-1 text-sm bg-background border border-border rounded text-text resize-none"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Assignee</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer">
              <input
                type="radio"
                checked={editAssignee === "user"}
                onChange={() => setEditAssignee("user")}
                className="accent-[var(--accent)]"
              />
              User
            </label>
            <label className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer">
              <input
                type="radio"
                checked={editAssignee === "agent"}
                onChange={() => setEditAssignee("agent")}
                className="accent-[var(--accent)]"
              />
              AI Agent
            </label>
          </div>
        </div>
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={() =>
              onUpdate(task.id, {
                title: editTitle,
                description: editDescription,
                assignee: editAssignee,
              })
            }
            disabled={!editTitle.trim()}
            className="text-xs px-2.5 py-1 rounded bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => onToggleEdit(task.id)}
            className="text-xs px-2.5 py-1 rounded text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className={`bg-surface border rounded-md p-3 cursor-grab active:cursor-grabbing hover:border-accent\/30 transition-colors ${
        isDone ? "opacity-70 border-border" : isBlocked ? "border-danger/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className={`text-sm font-medium text-text leading-tight ${isDone ? "line-through" : ""}`}>
          {task.title}
        </h4>
        <AssigneeBadge assignee={task.assignee} />
      </div>
      <p className="text-xs text-text-secondary mt-1.5 line-clamp-2 leading-relaxed">
        {task.description}
      </p>

      {/* Block reason */}
      {isBlocked && task.blockReason && (
        <div className="mt-2 p-2 rounded bg-danger/10 border border-danger/20">
          <p className="text-xs text-danger font-medium mb-0.5">Blocked:</p>
          <p className="text-xs text-text-secondary">{task.blockReason}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-2.5 relative">
        {isReview && task.assignee === "agent" && (
          <button
            onClick={() => onApprove(task.id)}
            className="text-xs px-2 py-0.5 rounded bg-success\/15 text-success hover:bg-success\/25 transition-colors"
          >
            Approve
          </button>
        )}
        <button
          onClick={() => {
            setEditTitle(task.title);
            setEditDescription(task.description);
            setEditAssignee(task.assignee);
            onToggleEdit(task.id);
          }}
          className="text-xs px-1.5 py-0.5 rounded bg-surface-hover text-text-muted hover:text-text-secondary transition-colors"
          title="Edit"
        >
          <EditIcon />
        </button>
        <button
          onClick={() => onToggleMoveMenu(task.id)}
          className="text-xs px-1.5 py-0.5 rounded bg-surface-hover text-text-muted hover:text-text-secondary transition-colors"
          title="Move to..."
        >
          <MoveIcon />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="text-xs px-1.5 py-0.5 rounded bg-surface-hover text-text-muted hover:text-danger transition-colors"
          title="Delete"
        >
          <TrashIcon />
        </button>

        {/* Move menu */}
        {moveMenuOpen && (
          <div className="absolute bottom-full left-0 mb-1 bg-surface border border-border rounded-md shadow-lg py-1 z-10 min-w-[120px]">
            {availableColumns.map((col) => (
              <button
                key={col}
                onClick={() => onMove(task.id, col)}
                className="block w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover transition-colors"
              >
                {columnLabels[col]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssigneeBadge({ assignee }: { assignee: TaskAssignee }) {
  if (assignee === "agent") {
    return (
      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-success\/15 text-success">
        AI
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[10px] font-semibold w-5 h-5 rounded-full bg-accent\/15 text-accent flex items-center justify-center">
      A
    </span>
  );
}

function ActivityDot({ action, actor }: { action: string; actor: string }) {
  let colorClass = "bg-accent";
  if (action === "picked-up") colorClass = "bg-accent";
  if (action === "completed") colorClass = "bg-success";
  if (action === "approved") colorClass = "bg-success";
  if (action === "created") colorClass = "bg-accent";
  if (actor === "agent" && action === "moved") colorClass = "bg-warning";

  return <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${colorClass}`} />;
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
