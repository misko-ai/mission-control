"use client";

import { useState, useEffect, useCallback } from "react";

type BugSeverity = "low" | "medium" | "high" | "critical";
type BugStatus = "open" | "in-progress" | "resolved";

interface BugNote {
  id: string;
  content: string;
  author: "user" | "agent";
  createdAt: string;
}

interface BugReport {
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

const severityBadge: Record<BugSeverity, string> = {
  critical: "bg-danger/15 text-danger",
  high: "bg-warning/15 text-warning",
  medium: "bg-accent/15 text-accent",
  low: "bg-surface-hover text-text-muted",
};

const statusBadge: Record<BugStatus, string> = {
  open: "bg-danger/15 text-danger",
  "in-progress": "bg-warning/15 text-warning",
  resolved: "bg-success/15 text-success",
};

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function BugsPage() {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formScreen, setFormScreen] = useState("");
  const [formSeverity, setFormSeverity] = useState<BugSeverity>("medium");
  const [formSteps, setFormSteps] = useState("");

  // Note form
  const [noteContent, setNoteContent] = useState("");

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/bugs");
      const data = await res.json();
      setBugs(data.bugs || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function createBug(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle || !formScreen) return;
    await fetch("/api/bugs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formTitle,
        screen: formScreen,
        severity: formSeverity,
        stepsToReproduce: formSteps,
      }),
    });
    setFormTitle("");
    setFormScreen("");
    setFormSeverity("medium");
    setFormSteps("");
    setShowForm(false);
    fetchData();
  }

  async function updateStatus(id: string, status: BugStatus) {
    await fetch("/api/bugs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchData();
  }

  async function addNote(bugId: string) {
    if (!noteContent.trim()) return;
    await fetch("/api/bugs/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bugId, content: noteContent }),
    });
    setNoteContent("");
    fetchData();
  }

  async function deleteBugById(id: string) {
    await fetch(`/api/bugs?id=${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    if (expandedId === id) setExpandedId(null);
    fetchData();
  }

  // Filtering
  const filtered = bugs.filter((b) => {
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || b.severity === severityFilter;
    return matchesStatus && matchesSeverity;
  });

  const openCount = bugs.filter((b) => b.status === "open").length;
  const inProgressCount = bugs.filter((b) => b.status === "in-progress").length;

  if (loading) {
    return (
      <div className="p-8 max-w-5xl">
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text">
            Bug Reports
          </h2>
          <p className="text-text-secondary text-sm mt-1">
            {bugs.length} {bugs.length === 1 ? "bug" : "bugs"}
            {openCount > 0 && ` · ${openCount} open`}
            {inProgressCount > 0 && ` · ${inProgressCount} in progress`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          {showForm ? "Cancel" : "+ Report Bug"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={createBug}
          className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-4"
        >
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Title</label>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Short bug description..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Screen / Feature</label>
              <input
                value={formScreen}
                onChange={(e) => setFormScreen(e.target.value)}
                placeholder="e.g. Taskboard, Calendar..."
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Severity</label>
              <select
                value={formSeverity}
                onChange={(e) => setFormSeverity(e.target.value as BugSeverity)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Steps to Reproduce / Context
            </label>
            <textarea
              value={formSteps}
              onChange={(e) => setFormSteps(e.target.value)}
              placeholder="How was this bug found..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formTitle || !formScreen}
              className="px-4 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Submit Bug
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(["all", "open", "in-progress", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                statusFilter === s
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text hover:bg-surface-hover"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(["all", "critical", "high", "medium", "low"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                severityFilter === s
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text hover:bg-surface-hover"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Bug list */}
      {filtered.length === 0 ? (
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-text-secondary text-sm">No bugs reported</p>
          <p className="text-xs text-text-muted mt-1">
            Report a bug when you encounter an issue
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((bug) => (
            <div
              key={bug.id}
              className="bg-surface border border-border rounded-lg hover:border-accent/30 transition-colors"
            >
              {/* Card header — clickable to expand */}
              <button
                onClick={() =>
                  setExpandedId(expandedId === bug.id ? null : bug.id)
                }
                className="w-full text-left p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-medium text-text">
                        {bug.title}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${severityBadge[bug.severity]}`}
                      >
                        {bug.severity}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${statusBadge[bug.status]}`}
                      >
                        {bug.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>{bug.screen}</span>
                      <span>{formatRelativeTime(bug.createdAt)}</span>
                      {bug.notes.length > 0 && (
                        <span>
                          {bug.notes.length} {bug.notes.length === 1 ? "note" : "notes"}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-text-muted shrink-0 transition-transform ${
                      expandedId === bug.id ? "rotate-180" : ""
                    }`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Expanded detail */}
              {expandedId === bug.id && (
                <div className="px-5 pb-5 border-t border-border-subtle">
                  {/* Steps to reproduce */}
                  {bug.stepsToReproduce && (
                    <div className="pt-4 mb-4">
                      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                        Steps to Reproduce
                      </h4>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap">
                        {bug.stepsToReproduce}
                      </p>
                    </div>
                  )}

                  {/* Status actions */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs text-text-muted">Status:</span>
                    {bug.status === "open" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus(bug.id, "in-progress");
                        }}
                        className="px-2.5 py-1 text-xs rounded-md bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
                      >
                        Mark In Progress
                      </button>
                    )}
                    {(bug.status === "open" || bug.status === "in-progress") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus(bug.id, "resolved");
                        }}
                        className="px-2.5 py-1 text-xs rounded-md bg-success/15 text-success hover:bg-success/25 transition-colors"
                      >
                        Mark Resolved
                      </button>
                    )}
                    {bug.status === "resolved" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus(bug.id, "open");
                        }}
                        className="px-2.5 py-1 text-xs rounded-md bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
                      >
                        Reopen
                      </button>
                    )}
                  </div>

                  {/* Notes */}
                  {bug.notes.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                        Notes
                      </h4>
                      <div className="space-y-2">
                        {bug.notes.map((note) => (
                          <div
                            key={note.id}
                            className="bg-background rounded-md p-3 border border-border-subtle"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  note.author === "agent"
                                    ? "bg-accent/15 text-accent"
                                    : "bg-surface-hover text-text-secondary"
                                }`}
                              >
                                {note.author}
                              </span>
                              <span className="text-xs text-text-muted">
                                {formatRelativeTime(note.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-text-secondary">
                              {note.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add note form */}
                  <div className="flex gap-2 mb-4">
                    <input
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 px-3 py-1.5 text-xs bg-background border border-border rounded-md text-text"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addNote(bug.id);
                        }
                      }}
                    />
                    <button
                      onClick={() => addNote(bug.id)}
                      disabled={!noteContent.trim()}
                      className="px-2.5 py-1 text-xs rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      Add Note
                    </button>
                  </div>

                  {/* Delete */}
                  <div className="flex items-center gap-1.5">
                    {confirmDelete === bug.id ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBugById(bug.id);
                          }}
                          className="px-2.5 py-1 text-xs rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(null);
                          }}
                          className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(bug.id);
                        }}
                        className="px-2.5 py-1 text-xs rounded-md text-danger/70 hover:bg-danger/10 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
