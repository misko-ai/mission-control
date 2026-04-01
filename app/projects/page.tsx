"use client";

import { useState, useEffect, useRef } from "react";
import type { TaskColumn, Task } from "@/lib/types";

interface ProjectProgress {
  total: number;
  done: number;
  percent: number;
}

interface ProjectWithProgress {
  id: string;
  name: string;
  description: string;
  status: "active" | "completed" | "archived";
  linkedTaskIds: string[];
  linkedTasks: Task[];
  progress: ProjectProgress;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
}

type StatusFilter = "all" | "active" | "completed" | "archived";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");

  // Edit state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (linkingId && searchRef.current) {
      searchRef.current.focus();
    }
  }, [linkingId]);

  async function fetchData() {
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
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!formName) return;

    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName, description: formDesc }),
    });

    setFormName("");
    setFormDesc("");
    setShowForm(false);
    fetchData();
  }

  async function updateProject(id: string) {
    await fetch("/api/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, description: editDesc }),
    });
    setEditingId(null);
    fetchData();
  }

  async function setProjectStatus(id: string, status: "active" | "completed" | "archived") {
    await fetch("/api/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchData();
  }

  async function deleteProject(id: string) {
    await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchData();
  }

  async function linkTask(projectId: string, taskId: string) {
    await fetch("/api/projects/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, taskId }),
    });
    setTaskSearch("");
    fetchData();
  }

  async function unlinkTask(projectId: string, taskId: string) {
    await fetch(`/api/projects/tasks?projectId=${projectId}&taskId=${taskId}`, {
      method: "DELETE",
    });
    fetchData();
  }

  function startEdit(project: ProjectWithProgress) {
    setEditingId(project.id);
    setEditName(project.name);
    setEditDesc(project.description);
  }

  const filtered =
    statusFilter === "all"
      ? projects
      : projects.filter((p) => p.status === statusFilter);

  const statusCounts = {
    all: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    completed: projects.filter((p) => p.status === "completed").length,
    archived: projects.filter((p) => p.status === "archived").length,
  };

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

  const statusBadge: Record<string, string> = {
    active: "bg-success/15 text-success",
    completed: "bg-accent/15 text-accent",
    archived: "bg-text-muted/15 text-text-muted",
  };

  function getUnlinkedTasks(project: ProjectWithProgress) {
    const linked = new Set(project.linkedTaskIds);
    return allTasks.filter(
      (t) =>
        !linked.has(t.id) &&
        t.title.toLowerCase().includes(taskSearch.toLowerCase())
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text">Projects</h2>
          <p className="text-text-secondary text-sm mt-1">
            {projects.length === 0
              ? "No projects yet"
              : `${statusCounts.active} active project${statusCounts.active !== 1 ? "s" : ""}`}
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
            <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
              Name
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Website Redesign"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
              Description
            </label>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="What is this project about..."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
            />
          </div>
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
      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-lg p-1 w-fit">
        {(["all", "active", "completed", "archived"] as StatusFilter[]).map((s) => (
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
              className="bg-surface border border-border rounded-lg p-5 hover:border-accent/30 transition-colors"
            >
              {editingId === project.id ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text font-medium"
                    autoFocus
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => updateProject(project.id)}
                      disabled={!editName}
                      className="px-3 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-text truncate">{project.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${statusBadge[project.status]}`}>
                          {project.status}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-xs text-text-secondary line-clamp-2">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => startEdit(project)}
                        className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                      >
                        Edit
                      </button>
                      {project.status === "active" ? (
                        <button
                          onClick={() => setProjectStatus(project.id, "archived")}
                          className="px-2.5 py-1 text-xs rounded-md text-warning hover:bg-warning/10 transition-colors"
                        >
                          Archive
                        </button>
                      ) : project.status === "archived" ? (
                        <button
                          onClick={() => setProjectStatus(project.id, "active")}
                          className="px-2.5 py-1 text-xs rounded-md text-success hover:bg-success/10 transition-colors"
                        >
                          Restore
                        </button>
                      ) : null}
                      {confirmDelete === project.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteProject(project.id)}
                            className="px-2.5 py-1 text-xs rounded-md bg-danger text-white hover:bg-danger/90 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(project.id)}
                          className="px-2.5 py-1 text-xs rounded-md text-danger hover:bg-danger/10 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-text-secondary">Progress</span>
                      <span className="text-xs text-text-muted">
                        {project.progress.percent}%{" "}
                        {project.progress.total > 0 && (
                          <span>
                            ({project.progress.done}/{project.progress.total})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-hover rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-300"
                        style={{ width: `${project.progress.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Linked Tasks */}
                  {project.linkedTasks.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-text-secondary mb-1.5">Linked tasks</p>
                      <div className="space-y-1">
                        {project.linkedTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-background group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${columnColor[task.column]}`}>
                                {columnLabel[task.column]}
                              </span>
                              <span className="text-xs text-text truncate">{task.title}</span>
                            </div>
                            <button
                              onClick={() => unlinkTask(project.id, task.id)}
                              className="text-text-muted hover:text-danger text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Link Task */}
                  {linkingId === project.id ? (
                    <div className="mb-3">
                      <input
                        ref={searchRef}
                        value={taskSearch}
                        onChange={(e) => setTaskSearch(e.target.value)}
                        placeholder="Search tasks to link..."
                        className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-md text-text mb-1.5"
                      />
                      {getUnlinkedTasks(project).length > 0 ? (
                        <div className="max-h-32 overflow-y-auto space-y-0.5">
                          {getUnlinkedTasks(project).map((task) => (
                            <button
                              key={task.id}
                              onClick={() => linkTask(project.id, task.id)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left hover:bg-surface-hover transition-colors"
                            >
                              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${columnColor[task.column]}`}>
                                {columnLabel[task.column]}
                              </span>
                              <span className="text-xs text-text truncate">{task.title}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted px-2.5 py-1.5">
                          {allTasks.length === 0
                            ? "No tasks available — create tasks on the Taskboard first"
                            : "No unlinked tasks match your search"}
                        </p>
                      )}
                      <button
                        onClick={() => { setLinkingId(null); setTaskSearch(""); }}
                        className="mt-1.5 text-xs text-text-secondary hover:text-text transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setLinkingId(project.id)}
                      className="text-xs text-accent hover:text-accent-hover transition-colors mb-3"
                    >
                      + Link task
                    </button>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-4 text-xs text-text-muted pt-2 border-t border-border-subtle">
                    <span>Last active {relativeTime(project.lastActiveAt)}</span>
                    <span>Created {relativeTime(project.createdAt)}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-3 text-text-muted"
          >
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
