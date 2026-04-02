"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ScheduledEvent,
  ScheduleType,
  ScheduleStatus,
  EventType,
  EventOwner,
  EventPriority,
} from "@/lib/types";
import { EditIcon, TrashIcon } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/fetch";

type EventTypeFilter = "all" | EventType;
type StatusFilter = "all" | ScheduleStatus;

const EVENT_TYPES: EventType[] = ["automation", "reminder", "deadline", "review"];
const STATUSES: ScheduleStatus[] = ["active", "paused", "failed", "completed", "draft"];

const eventTypeLabel: Record<EventType, string> = {
  automation: "Automation",
  reminder: "Reminder",
  deadline: "Deadline",
  review: "Review",
};

const eventTypeBadge: Record<EventType, string> = {
  automation: "bg-accent/15 text-accent",
  reminder: "bg-warning/15 text-warning",
  deadline: "bg-danger/15 text-danger",
  review: "bg-success/15 text-success",
};

const eventTypeAccent: Record<EventType, string> = {
  automation: "text-accent",
  reminder: "text-warning",
  deadline: "text-danger",
  review: "text-success",
};

const statusColor: Record<ScheduleStatus, string> = {
  active: "bg-success",
  paused: "bg-warning",
  completed: "bg-text-muted",
  failed: "bg-danger",
  draft: "bg-border",
};

const statusBadge: Record<ScheduleStatus, string> = {
  active: "bg-success/15 text-success",
  paused: "bg-warning/15 text-warning",
  completed: "bg-text-muted/15 text-text-muted",
  failed: "bg-danger/15 text-danger",
  draft: "bg-surface-hover text-text-muted",
};

function resolveEventType(event: ScheduledEvent): EventType {
  return event.eventType || "automation";
}

function emptyForm() {
  return {
    name: "",
    description: "",
    eventType: "automation" as EventType,
    scheduleType: "recurring" as ScheduleType,
    schedule: "",
    cronExpression: "",
    owner: "user" as EventOwner,
    priority: "medium" as EventPriority,
    dueDate: "",
    linkedTaskId: "",
    linkedDocId: "",
    linkedCronId: "",
    status: "active" as ScheduleStatus,
  };
}

export default function CalendarPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [editForm, setEditForm] = useState(emptyForm());

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar");
      const data = await res.json();
      setEvents(data.events || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.schedule) return;

    const result = await apiFetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        eventType: form.eventType,
        scheduleType: form.scheduleType,
        schedule: form.schedule,
        cronExpression: form.cronExpression || undefined,
        owner: form.owner,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        linkedTaskId: form.linkedTaskId || undefined,
        linkedDocId: form.linkedDocId || undefined,
        linkedCronId: form.linkedCronId || undefined,
        status: form.status,
      }),
    });
    if (!result.ok) { toast(result.error, "error"); return; }

    setForm(emptyForm());
    setShowForm(false);
    fetchEvents();
  }

  async function updateEvent(id: string) {
    const result = await apiFetch("/api/calendar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: editForm.name,
        description: editForm.description,
        eventType: editForm.eventType,
        scheduleType: editForm.scheduleType,
        schedule: editForm.schedule,
        cronExpression: editForm.cronExpression || undefined,
        owner: editForm.owner,
        priority: editForm.priority,
        dueDate: editForm.dueDate || undefined,
        linkedTaskId: editForm.linkedTaskId || undefined,
        linkedDocId: editForm.linkedDocId || undefined,
        linkedCronId: editForm.linkedCronId || undefined,
        status: editForm.status,
      }),
    });
    if (!result.ok) { toast(result.error, "error"); return; }
    setEditingId(null);
    fetchEvents();
  }

  async function togglePause(event: ScheduledEvent) {
    const newStatus = event.status === "active" ? "paused" : "active";
    const result = await apiFetch("/api/calendar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id, status: newStatus }),
    });
    if (!result.ok) { toast(result.error, "error"); }
    fetchEvents();
  }

  async function deleteEvent(id: string) {
    const result = await apiFetch(`/api/calendar?id=${id}`, { method: "DELETE" });
    if (!result.ok) { toast(result.error, "error"); return; }
    setConfirmDelete(null);
    fetchEvents();
  }

  function startEditing(event: ScheduledEvent) {
    setEditingId(event.id);
    setEditForm({
      name: event.name,
      description: event.description,
      eventType: resolveEventType(event),
      scheduleType: event.scheduleType,
      schedule: event.schedule,
      cronExpression: event.cronExpression || "",
      owner: event.owner || "user",
      priority: event.priority || "medium",
      dueDate: event.dueDate || "",
      linkedTaskId: event.linkedTaskId || "",
      linkedDocId: event.linkedDocId || "",
      linkedCronId: event.linkedCronId || "",
      status: event.status,
    });
  }

  // --- Computed ---

  const filtered = events.filter((e) => {
    if (eventTypeFilter !== "all" && resolveEventType(e) !== eventTypeFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const eventTypeCounts: Record<EventTypeFilter, number> = {
    all: events.length,
    automation: events.filter((e) => resolveEventType(e) === "automation").length,
    reminder: events.filter((e) => resolveEventType(e) === "reminder").length,
    deadline: events.filter((e) => resolveEventType(e) === "deadline").length,
    review: events.filter((e) => resolveEventType(e) === "review").length,
  };

  const statusCounts: Record<StatusFilter, number> = {
    all: events.length,
    active: events.filter((e) => e.status === "active").length,
    paused: events.filter((e) => e.status === "paused").length,
    failed: events.filter((e) => e.status === "failed").length,
    completed: events.filter((e) => e.status === "completed").length,
    draft: events.filter((e) => e.status === "draft").length,
  };

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const deadlinesDueSoon = events.filter(
    (e) =>
      resolveEventType(e) === "deadline" &&
      e.status === "active" &&
      e.dueDate &&
      new Date(e.dueDate).getTime() - now < sevenDaysMs &&
      new Date(e.dueDate).getTime() >= now
  ).length;

  const automationsFailed = events.filter(
    (e) => resolveEventType(e) === "automation" && e.status === "failed"
  ).length;

  // --- Helpers ---

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

  function schedulePlaceholder(type: EventType) {
    switch (type) {
      case "automation": return "Daily at 07:30 Europe/Zagreb";
      case "reminder": return "Every Friday at 5pm";
      case "deadline": return "Apr 10, 2026";
      case "review": return "Every Monday at 9am";
    }
  }

  // --- Render ---

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text">Calendar</h2>
          <p className="text-text-secondary text-sm mt-1">
            {events.length === 0
              ? "No scheduled events yet"
              : `${events.length} event${events.length !== 1 ? "s" : ""} — ${eventTypeCounts.automation} automations, ${eventTypeCounts.deadline} deadlines`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); if (editingId) setEditingId(null); }}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          {showForm ? "Cancel" : "+ New Event"}
        </button>
      </div>

      {/* Summary Cards */}
      {events.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="Automations"
            count={eventTypeCounts.automation}
            accent="text-accent"
            sub={automationsFailed > 0 ? `${automationsFailed} failed` : "all healthy"}
            subColor={automationsFailed > 0 ? "text-danger" : "text-text-muted"}
          />
          <SummaryCard
            label="Reminders"
            count={eventTypeCounts.reminder}
            accent="text-warning"
            sub={`${events.filter(e => resolveEventType(e) === "reminder" && e.status === "active").length} active`}
            subColor="text-text-muted"
          />
          <SummaryCard
            label="Deadlines"
            count={eventTypeCounts.deadline}
            accent="text-danger"
            sub={deadlinesDueSoon > 0 ? `${deadlinesDueSoon} due this week` : "none due soon"}
            subColor={deadlinesDueSoon > 0 ? "text-warning" : "text-text-muted"}
          />
          <SummaryCard
            label="Reviews"
            count={eventTypeCounts.review}
            accent="text-success"
            sub={`${events.filter(e => resolveEventType(e) === "review" && e.status === "active").length} active`}
            subColor="text-text-muted"
          />
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <EventForm
          form={form}
          setForm={setForm}
          onSubmit={createEvent}
          submitLabel="Create Event"
          onCancel={() => { setShowForm(false); setForm(emptyForm()); }}
          schedulePlaceholder={schedulePlaceholder}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(["all", ...EVENT_TYPES] as EventTypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setEventTypeFilter(t)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize flex items-center gap-1.5 ${
                eventTypeFilter === t
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text hover:bg-surface-hover"
              }`}
            >
              {t === "all" ? "All" : eventTypeLabel[t]}
              {eventTypeCounts[t] > 0 && (
                <span className={`text-xs ${eventTypeFilter === t ? "opacity-70" : "text-text-muted"}`}>
                  {eventTypeCounts[t]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(["all", ...STATUSES] as StatusFilter[]).map((s) => (
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
          {filtered.map((event) =>
            editingId === event.id ? (
              <div key={event.id} className="bg-surface border border-accent/30 rounded-lg">
                <EventForm
                  form={editForm}
                  setForm={setEditForm}
                  onSubmit={(e) => { e.preventDefault(); updateEvent(event.id); }}
                  submitLabel="Save Changes"
                  onCancel={() => setEditingId(null)}
                  schedulePlaceholder={schedulePlaceholder}
                  isEdit
                />
              </div>
            ) : (
              <EventCard
                key={event.id}
                event={event}
                onTogglePause={() => togglePause(event)}
                onEdit={() => startEditing(event)}
                onDelete={() => deleteEvent(event.id)}
                confirmDelete={confirmDelete}
                setConfirmDelete={setConfirmDelete}
                formatDate={formatDate}
                relativeTime={relativeTime}
              />
            )
          )}
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
            {eventTypeFilter === "all" && statusFilter === "all"
              ? "No scheduled events yet"
              : "No events match the current filters"}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {eventTypeFilter === "all" && statusFilter === "all"
              ? "Create automations, reminders, deadlines, and review cadences"
              : "Try adjusting your filters"}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function SummaryCard({
  label,
  count,
  accent,
  sub,
  subColor,
}: {
  label: string;
  count: number;
  accent: string;
  sub: string;
  subColor: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent}`}>{count}</p>
      <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>
    </div>
  );
}

type FormData = ReturnType<typeof emptyForm>;

function EventForm({
  form,
  setForm,
  onSubmit,
  submitLabel,
  onCancel,
  schedulePlaceholder,
  isEdit,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onCancel: () => void;
  schedulePlaceholder: (t: EventType) => string;
  isEdit?: boolean;
}) {
  const update = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <form
      onSubmit={onSubmit}
      className={`bg-surface ${isEdit ? "" : "border border-border rounded-lg"} p-5 mb-6 space-y-4`}
    >
      {/* Name */}
      <div>
        <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">Name</label>
        <input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Daily geopolitics report"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
          autoFocus={!isEdit}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="What this event does or tracks..."
          rows={2}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
        />
      </div>

      {/* Event Type Selector */}
      <div>
        <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">Event Type</label>
        <div className="flex gap-1 bg-surface-hover rounded-lg p-1">
          {(["automation", "reminder", "deadline", "review"] as EventType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                update("eventType", t);
                if (t === "deadline") update("scheduleType", "one-time");
                else if (form.scheduleType === "one-time") update("scheduleType", "recurring");
              }}
              className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                form.eventType === t
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              {eventTypeLabel[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Type + Owner */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">Schedule Type</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
              <input
                type="radio"
                name={`scheduleType-${isEdit ? "edit" : "create"}`}
                checked={form.scheduleType === "recurring"}
                onChange={() => update("scheduleType", "recurring")}
                className="accent-accent"
              />
              Recurring
            </label>
            <label className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
              <input
                type="radio"
                name={`scheduleType-${isEdit ? "edit" : "create"}`}
                checked={form.scheduleType === "one-time"}
                onChange={() => update("scheduleType", "one-time")}
                className="accent-accent"
              />
              One-time
            </label>
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">Owner</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
              <input
                type="radio"
                name={`owner-${isEdit ? "edit" : "create"}`}
                checked={form.owner === "user"}
                onChange={() => update("owner", "user")}
                className="accent-accent"
              />
              User
            </label>
            <label className="flex items-center gap-1.5 text-sm text-text cursor-pointer">
              <input
                type="radio"
                name={`owner-${isEdit ? "edit" : "create"}`}
                checked={form.owner === "agent"}
                onChange={() => update("owner", "agent")}
                className="accent-accent"
              />
              Agent
            </label>
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div>
        <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">Schedule</label>
        <input
          value={form.schedule}
          onChange={(e) => update("schedule", e.target.value)}
          placeholder={schedulePlaceholder(form.eventType)}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
        />
      </div>

      {/* Conditional: Cron for automation/review */}
      {(form.eventType === "automation" || form.eventType === "review") && form.scheduleType === "recurring" && (
        <div>
          <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
            Cron Expression <span className="normal-case">(optional)</span>
          </label>
          <input
            value={form.cronExpression}
            onChange={(e) => update("cronExpression", e.target.value)}
            placeholder="0 8 * * *"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text font-mono"
          />
        </div>
      )}

      {/* Conditional: Due date for deadline */}
      {form.eventType === "deadline" && (
        <div>
          <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">Due Date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => update("dueDate", e.target.value)}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
          />
        </div>
      )}

      {/* Priority + Status (edit only) */}
      <div className={`grid ${isEdit ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
        <div>
          <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => update("priority", e.target.value)}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">Status</label>
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="failed">Failed</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        )}
      </div>

      {/* Linked entities */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
            Linked Task ID <span className="normal-case">(optional)</span>
          </label>
          <input
            value={form.linkedTaskId}
            onChange={(e) => update("linkedTaskId", e.target.value)}
            placeholder="Task UUID"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
            Linked Doc ID <span className="normal-case">(optional)</span>
          </label>
          <input
            value={form.linkedDocId}
            onChange={(e) => update("linkedDocId", e.target.value)}
            placeholder="Doc UUID"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1 uppercase tracking-wide">
            Linked Cron ID <span className="normal-case">(optional)</span>
          </label>
          <input
            value={form.linkedCronId}
            onChange={(e) => update("linkedCronId", e.target.value)}
            placeholder="Cron UUID"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text font-mono text-xs"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!form.name || !form.schedule}
          className="px-4 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function EventCard({
  event,
  onTogglePause,
  onEdit,
  onDelete,
  confirmDelete,
  setConfirmDelete,
  formatDate,
  relativeTime,
}: {
  event: ScheduledEvent;
  onTogglePause: () => void;
  onEdit: () => void;
  onDelete: () => void;
  confirmDelete: string | null;
  setConfirmDelete: (id: string | null) => void;
  formatDate: (iso?: string) => string;
  relativeTime: (iso: string) => string;
}) {
  const type = resolveEventType(event);

  return (
    <div className="bg-surface border border-border rounded-lg p-5 hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Row 1: status + name + badges */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor[event.status]}`} />
            <h3 className="text-sm font-medium text-text truncate">{event.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${eventTypeBadge[type]}`}>
              {eventTypeLabel[type]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
              event.scheduleType === "recurring"
                ? "bg-surface-hover text-text-secondary"
                : "bg-surface-hover text-text-secondary"
            }`}>
              {event.scheduleType === "recurring" ? "Recurring" : "One-time"}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${statusBadge[event.status]}`}>
              {event.status}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
              event.owner === "agent" ? "bg-success/15 text-success" : "bg-surface-hover text-text-muted"
            }`}>
              {event.owner === "agent" ? "Agent" : "User"}
            </span>
            {event.priority && event.priority !== "medium" && (
              <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                event.priority === "high" ? "bg-danger/15 text-danger" : "bg-surface-hover text-text-muted"
              }`}>
                {event.priority}
              </span>
            )}
          </div>

          {/* Row 2: description */}
          {event.description && (
            <p className="text-xs text-text-secondary mb-2 ml-[18px]">{event.description}</p>
          )}

          {/* Row 3: metadata */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 ml-[18px] text-xs text-text-muted">
            <span>
              <span className="text-text-secondary">Schedule:</span> {event.schedule}
            </span>
            {event.cronExpression && (
              <span className="font-mono">
                <span className="text-text-secondary font-sans">Cron:</span> {event.cronExpression}
              </span>
            )}
            {event.dueDate && (
              <span>
                <span className="text-text-secondary">Due:</span> {formatDate(event.dueDate)}
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
            {event.lastOutcome && (
              <span>
                <span className="text-text-secondary">Outcome:</span>{" "}
                <span className={
                  event.lastOutcome === "ok" ? "text-success" :
                  event.lastOutcome === "failed" ? "text-danger" :
                  "text-warning"
                }>
                  {event.lastOutcome}
                </span>
              </span>
            )}
            <span>
              <span className="text-text-secondary">Created:</span> {relativeTime(event.createdAt)}
            </span>
          </div>

          {/* Row 4: linked entities */}
          {(event.linkedTaskId || event.linkedDocId || event.linkedCronId) && (
            <div className="flex flex-wrap gap-1.5 ml-[18px] mt-2">
              {event.linkedTaskId && (
                <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                  Task: {event.linkedTaskId.slice(0, 8)}...
                </span>
              )}
              {event.linkedDocId && (
                <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                  Doc: {event.linkedDocId.slice(0, 8)}...
                </span>
              )}
              {event.linkedCronId && (
                <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                  Cron: {event.linkedCronId.slice(0, 8)}...
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(event.status === "active" || event.status === "paused") && (
            <button
              onClick={onTogglePause}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                event.status === "active"
                  ? "text-warning hover:bg-warning/10"
                  : "text-success hover:bg-success/10"
              }`}
            >
              {event.status === "active" ? "Pause" : "Resume"}
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 text-text-muted hover:text-text-secondary hover:bg-surface-hover rounded-md transition-colors"
            title="Edit"
          >
            <EditIcon size={14} />
          </button>
          {confirmDelete === event.id ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onDelete}
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
              className="p-1.5 text-danger/60 hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
              title="Delete"
            >
              <TrashIcon size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
