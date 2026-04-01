"use client";

import { useState, useEffect } from "react";
import type { ActivityEntry } from "@/lib/types";

type FilterAction = "all" | "created" | "executed" | "updated" | "deleted";

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [filter, setFilter] = useState<FilterAction>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    setLoading(true);
    try {
      const res = await fetch("/api/activities");
      const data = await res.json();
      setActivities(data.activities || []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "all"
    ? activities
    : activities.filter((a) => a.action === filter);

  const counts = {
    all: activities.length,
    created: activities.filter((a) => a.action === "created").length,
    executed: activities.filter((a) => a.action === "executed").length,
    updated: activities.filter((a) => a.action === "updated").length,
    deleted: activities.filter((a) => a.action === "deleted").length,
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text">Activity</h2>
          <p className="text-text-secondary text-sm mt-1">
            {activities.length === 0
              ? "No events recorded yet"
              : `${activities.length} event${activities.length !== 1 ? "s" : ""} total`}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-lg p-1 w-fit">
        {(["all", "created", "executed", "updated", "deleted"] as FilterAction[]).map((action) => (
          <button
            key={action}
            onClick={() => setFilter(action)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize flex items-center gap-1.5 ${
              filter === action
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text hover:bg-surface-hover"
            }`}
          >
            {action}
            {counts[action] > 0 && (
              <span className={`text-xs ${filter === action ? "opacity-70" : "text-text-muted"}`}>
                {counts[action]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-text-secondary text-sm">Loading activity...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3 uppercase tracking-wide w-28">
                  Action
                </th>
                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3 uppercase tracking-wide">
                  Details
                </th>
                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3 uppercase tracking-wide w-44">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border-subtle last:border-0 hover:bg-surface-hover transition-colors"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex text-xs px-2 py-0.5 rounded font-medium ${
                        entry.action === "created"
                          ? "bg-success/15 text-success"
                          : entry.action === "executed"
                          ? "bg-accent/15 text-accent"
                          : entry.action === "updated"
                          ? "bg-warning/15 text-warning"
                          : "bg-danger/15 text-danger"
                      }`}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text">{entry.details}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-text-secondary">
            {filter === "all" ? "No activity yet" : `No ${filter} events`}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {filter === "all"
              ? "Activity will appear here as you use your tools"
              : "Try a different filter or create some tools"}
          </p>
        </div>
      )}
    </div>
  );
}
