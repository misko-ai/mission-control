"use client";

import { useState, useEffect, useRef } from "react";

interface Entity {
  id: string;
  title?: string;
  name?: string;
}

interface EntityLinkerProps {
  label: string;
  linkedIds: string[];
  apiBase: string;
  entityIdParam: string;
  projectId: string;
  onRefresh: () => void;
}

export default function EntityLinker({
  label,
  linkedIds,
  apiBase,
  entityIdParam,
  projectId,
  onRefresh,
}: EntityLinkerProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearch) {
      fetch(apiBase)
        .then((r) => r.json())
        .then((data) => {
          // Handle different API response shapes
          const items: Entity[] =
            data.docs || data.bugs || data.memories || data.events ||
            data.conversationMemories || data.longTermMemories ||
            data.scheduledEvents || [];

          // Merge conversation + long-term memories if both exist
          if (data.conversationMemories || data.longTermMemories) {
            const merged = [
              ...(data.conversationMemories || []),
              ...(data.longTermMemories || []),
            ];
            setEntities(merged);
          } else {
            setEntities(Array.isArray(items) ? items : []);
          }
        });
      searchRef.current?.focus();
    }
  }, [showSearch, apiBase]);

  async function link(entityId: string) {
    const res = await fetch("/api/projects/" + label.toLowerCase().replace(/ /g, ""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, [entityIdParam]: entityId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || `Failed to link ${label.toLowerCase()}`);
      return;
    }
    setSearch("");
    onRefresh();
  }

  async function unlink(entityId: string) {
    const res = await fetch(
      `/api/projects/${label.toLowerCase().replace(/ /g, "")}?projectId=${projectId}&${entityIdParam}=${entityId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || `Failed to unlink ${label.toLowerCase()}`);
      return;
    }
    onRefresh();
  }

  const linkedSet = new Set(linkedIds);
  const unlinked = entities.filter(
    (e) =>
      !linkedSet.has(e.id) &&
      (e.title || e.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const linked = entities.filter((e) => linkedSet.has(e.id));

  return (
    <div>
      {linked.length > 0 && (
        <div className="space-y-1 mb-2">
          {linked.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-background group"
            >
              <span className="text-xs text-text truncate">{e.title || e.name}</span>
              <button
                onClick={() => unlink(e.id)}
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

      {showSearch ? (
        <div>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${label.toLowerCase()} to link...`}
            className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-md text-text mb-1.5"
          />
          {unlinked.length > 0 ? (
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {unlinked.map((e) => (
                <button
                  key={e.id}
                  onClick={() => link(e.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left hover:bg-surface-hover transition-colors"
                >
                  <span className="text-xs text-text truncate">{e.title || e.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted px-2.5 py-1.5">No items to link</p>
          )}
          <button
            onClick={() => { setShowSearch(false); setSearch(""); }}
            className="mt-1.5 text-xs text-text-secondary hover:text-text transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSearch(true)}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          + Link {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}
