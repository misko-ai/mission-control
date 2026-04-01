"use client";

import { useState, useEffect } from "react";

type ScheduleType = "recurring" | "one-time";
type ScheduleStatus = "active" | "paused" | "completed" | "failed";
type TypeFilter = "all" | "recurring" | "one-time";
type StatusFilter = "all" | "active" | "paused" | "completed" | "failed";

interface ScheduledEvent {
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

export default function CalendarPage() {
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<ScheduleType>("recurring");
  const [formSchedule, setFormSchedule] = useState("");
  const [formCron, setFormCron] = useState("");

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchEvents() {
    try {
      const res = await fetch("/api/calendar");
      const data = await res.json();
      setEvents(data.events || []);
    } finally {
      setLoading(false);
    }
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!formName || !formSchedule) return;

    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        description: formDesc,
        scheduleType: formType,
        schedule: formSchedule,
        cronExpression: formCron || undefined,
      }),
    });

    setFormName("");
    setFormDesc("");
    setFormType("recurring");
    setFormSchedule("");
    setFormCron("");
    setShowForm(false);
    fetchEvents();
  }

  async function togglePause(event: ScheduledEvent) {
    const newStatus = event.status === "active" ? "paused" : "active";
    await fetch("/api/calendar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id, status: newStatus }),
    });
    fetchEvents();
  }

  async function deleteEvent(id: string) {
    await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchEvents();
  }

  const filtered = events.filter((e) => {
    if (typeFilter !== "all" && e.scheduleType !== typeFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const typeCounts = {
    all: events.length,
    recurring: events.filter((e) => e.scheduleType === "recurring").length,
    "one-time": events.filter((e) => e.scheduleType === "one-time").length,
  };

  const statusCounts = {
    all: events.length,
    active: events.filter((e) => e.status === "active").length,
    paused: events.filter((e) => e.status === "paused").length,
    completed: events.filter((e) => e.status === "completed").length,
    failed: events.filter((e) => e.status === "failed").length,
  };

  function formatDate(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

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

  const statusColor: Record<ScheduleStatus, string> = {
    active: "bg-success",
    paused: "bg-warning",
    completed: "bg-text-muted",
    failed: "bg-danger",
  };

  const statusBadge: Record<ScheduleStatus, string> = {
    active: "bg-success/15 text-success",
    paused: "bg-warning/15 text-warning",
    completed: "bg-text-muted/15 text-text-muted",
    failed: "bg-danger/15 text-danger",
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text">Calendar</h2>
          <p className="text-text-secondary text-sm mt-1">
            {events.length === 0
              ? "No scheduled events yet"
              : `${events.length} scheduled event${events.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          {showForm ? "Cancel" : "+ New Event"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={createEvent}
          className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-4"
        >
          <div>
            <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
              Name
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Daily morning briefing"
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
              placeholder="What this scheduled event does..."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
                Type
              </label>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={formType === "recurring"}
                    onChange={() => setFormType("recurring")}
                    className="accent-accent"
                  />
                  Recurring
                </label>
                <label className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={formType === "one-time"}
                    onChange={() => setFormType("one-time")}
                    className="accent-accent"
                  />
                  One-time
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
                Schedule
              </label>
              <input
                value={formSchedule}
                onChange={(e) => setFormSchedule(e.target.value)}
                placeholder={formType === "recurring" ? "Every morning at 8am" : "Apr 5, 2026 at 3:00 PM"}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              />
            </div>
          </div>
          {formType === "recurring" && (
            <div>
              <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
                Cron Expression <span className="normal-case">(optional)</span>
              </label>
              <input
                value={formCron}
                onChange={(e) => setFormCron(e.target.value)}
                placeholder="0 8 * * *"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text font-mono"
              />
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!formName || !formSchedule}
              className="px-4 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Create Event
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(["all", "recurring", "one-time"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize flex items-center gap-1.5 ${
                typeFilter === t
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text hover:bg-surface-hover"
              }`}
            >
              {t === "one-time" ? "One-time" : t}
              {typeCounts[t] > 0 && (
                <span className={`text-xs ${typeFilter === t ? "opacity-70" : "text-text-muted"}`}>
                  {typeCounts[t]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(["all", "active", "paused", "completed", "failed"] as StatusFilter[]).map((s) => (
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
      </div>

      {/* Events List */}
      {loading ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-text-secondary text-sm">Loading events...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((event) => (
            <div
              key={event.id}
              className="bg-surface border border-border rounded-lg p-5 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor[event.status]}`} />
                    <h3 className="text-sm font-medium text-text truncate">{event.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                        event.scheduleType === "recurring"
                          ? "bg-accent/15 text-accent"
                          : "bg-warning/15 text-warning"
                      }`}
                    >
                      {event.scheduleType === "recurring" ? "Recurring" : "One-time"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${statusBadge[event.status]}`}>
                      {event.status}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-xs text-text-secondary mb-2 ml-[18px]">{event.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 ml-[18px] text-xs text-text-muted">
                    <span>
                      <span className="text-text-secondary">Schedule:</span> {event.schedule}
                    </span>
                    {event.cronExpression && (
                      <span className="font-mono">
                        <span className="text-text-secondary font-sans">Cron:</span> {event.cronExpression}
                      </span>
                    )}
                    {event.nextRunAt && (
                      <span>
                        <span className="text-text-secondary">Next:</span> {formatDate(event.nextRunAt)}
                      </span>
                    )}
                    {event.lastRunAt && (
                      <span>
                        <span className="text-text-secondary">Last run:</span> {formatDate(event.lastRunAt)}
                      </span>
                    )}
                    <span>
                      <span className="text-text-secondary">Created:</span> {relativeTime(event.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(event.status === "active" || event.status === "paused") && (
                    <button
                      onClick={() => togglePause(event)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                        event.status === "active"
                          ? "text-warning hover:bg-warning/10"
                          : "text-success hover:bg-success/10"
                      }`}
                    >
                      {event.status === "active" ? "Pause" : "Resume"}
                    </button>
                  )}
                  {confirmDelete === event.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteEvent(event.id)}
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
                      onClick={() => setConfirmDelete(event.id)}
                      className="px-2.5 py-1 text-xs rounded-md text-danger hover:bg-danger/10 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
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
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-text-secondary text-sm">
            {typeFilter === "all" && statusFilter === "all"
              ? "No scheduled events yet"
              : "No events match the current filters"}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {typeFilter === "all" && statusFilter === "all"
              ? "Scheduled cron jobs and tasks will appear here as the agent creates them"
              : "Try adjusting your filters"}
          </p>
        </div>
      )}
    </div>
  );
}
