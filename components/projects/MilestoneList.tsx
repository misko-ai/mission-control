"use client";

import { useState } from "react";
import type { Milestone, MilestoneStatus } from "@/lib/types";

const msStatusBadge: Record<MilestoneStatus, string> = {
  pending: "bg-text-muted/15 text-text-muted",
  "in-progress": "bg-accent/15 text-accent",
  completed: "bg-success/15 text-success",
};

const nextStatus: Record<MilestoneStatus, MilestoneStatus> = {
  pending: "in-progress",
  "in-progress": "completed",
  completed: "pending",
};

interface MilestoneListProps {
  milestones: Milestone[];
  projectId: string;
  onRefresh: () => void;
}

export default function MilestoneList({ milestones, projectId, onRefresh }: MilestoneListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    const res = await fetch("/api/projects/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, title, dueDate: dueDate || undefined }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.fields?.map((f: { message: string }) => f.message).join(", ") || body.error || "Failed to add milestone");
      return;
    }
    setTitle("");
    setDueDate("");
    setShowAdd(false);
    onRefresh();
  }

  async function toggleStatus(milestoneId: string, current: MilestoneStatus) {
    const res = await fetch("/api/projects/milestones", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, milestoneId, status: nextStatus[current] }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Failed to update milestone");
    }
    onRefresh();
  }

  async function deleteMilestone(milestoneId: string) {
    const res = await fetch(`/api/projects/milestones?projectId=${projectId}&milestoneId=${milestoneId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Failed to delete milestone");
    }
    onRefresh();
  }

  return (
    <div>
      {milestones.length > 0 && (
        <div className="space-y-1 mb-2">
          {milestones.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-background group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => toggleStatus(m.id, m.status)}
                  className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${msStatusBadge[m.status]} hover:opacity-80 transition-opacity`}
                >
                  {m.status}
                </button>
                <span className={`text-xs truncate ${m.status === "completed" ? "text-text-muted line-through" : "text-text"}`}>
                  {m.title}
                </span>
                {m.dueDate && (
                  <span className="text-[10px] text-text-muted shrink-0">{m.dueDate}</span>
                )}
              </div>
              <button
                onClick={() => deleteMilestone(m.id)}
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
      )}

      {showAdd ? (
        <form onSubmit={addMilestone} className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Milestone title"
            className="flex-1 px-2.5 py-1.5 text-xs bg-background border border-border rounded-md text-text"
            autoFocus
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-2 py-1.5 text-xs bg-background border border-border rounded-md text-text"
          />
          <button
            type="submit"
            disabled={!title}
            className="px-2.5 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setShowAdd(false); setTitle(""); setDueDate(""); }}
            className="px-2.5 py-1.5 text-xs text-text-secondary hover:text-text"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          + Add milestone
        </button>
      )}
    </div>
  );
}
