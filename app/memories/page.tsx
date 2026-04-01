"use client";

import { useState, useEffect, useCallback } from "react";
import type { ConversationMemory, LongTermMemoryCategory, LongTermMemory } from "@/lib/types";

type MemoryTab = "conversation" | "longterm";

const categoryBadge: Record<string, string> = {
  preference: "bg-accent/15 text-accent",
  decision: "bg-warning/15 text-warning",
  fact: "bg-success/15 text-success",
  context: "bg-text-muted/15 text-text-muted",
  other: "bg-surface-hover text-text-secondary",
};

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MemoriesPage() {
  const [tab, setTab] = useState<MemoryTab>("conversation");
  const [conversationMemories, setConversationMemories] = useState<ConversationMemory[]>([]);
  const [longTermMemories, setLongTermMemories] = useState<LongTermMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Conversation form
  const [showConvForm, setShowConvForm] = useState(false);
  const [convFormDate, setConvFormDate] = useState("");
  const [convFormTitle, setConvFormTitle] = useState("");
  const [convFormContent, setConvFormContent] = useState("");
  const [convFormTags, setConvFormTags] = useState("");

  // Long-term form
  const [showLtForm, setShowLtForm] = useState(false);
  const [ltFormTitle, setLtFormTitle] = useState("");
  const [ltFormContent, setLtFormContent] = useState("");
  const [ltFormCategory, setLtFormCategory] = useState<LongTermMemoryCategory>("other");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editCategory, setEditCategory] = useState<LongTermMemoryCategory>("other");

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [convRes, ltRes] = await Promise.all([
        fetch("/api/memories/conversation"),
        fetch("/api/memories/longterm"),
      ]);
      const convData = await convRes.json();
      const ltData = await ltRes.json();
      setConversationMemories(convData.memories || []);
      setLongTermMemories(ltData.memories || []);
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

  // Conversation CRUD

  async function createConversationMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!convFormTitle || !convFormContent) return;
    const tags = convFormTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await fetch("/api/memories/conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: convFormDate || new Date().toISOString().split("T")[0],
        title: convFormTitle,
        content: convFormContent,
        tags,
      }),
    });
    setConvFormDate("");
    setConvFormTitle("");
    setConvFormContent("");
    setConvFormTags("");
    setShowConvForm(false);
    fetchData();
  }

  async function saveConvEdit(id: string) {
    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await fetch("/api/memories/conversation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: editTitle, content: editContent, tags }),
    });
    setEditingId(null);
    fetchData();
  }

  async function deleteConvMemory(id: string) {
    await fetch(`/api/memories/conversation?id=${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchData();
  }

  // Long-term CRUD

  async function createLongTermMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!ltFormTitle || !ltFormContent) return;
    await fetch("/api/memories/longterm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: ltFormTitle,
        content: ltFormContent,
        category: ltFormCategory,
      }),
    });
    setLtFormTitle("");
    setLtFormContent("");
    setLtFormCategory("other");
    setShowLtForm(false);
    fetchData();
  }

  async function saveLtEdit(id: string) {
    await fetch("/api/memories/longterm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: editTitle,
        content: editContent,
        category: editCategory,
      }),
    });
    setEditingId(null);
    fetchData();
  }

  async function deleteLtMemory(id: string) {
    await fetch(`/api/memories/longterm?id=${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchData();
  }

  // Filtering

  const filteredConversation = conversationMemories.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDate = !selectedDate || m.date === selectedDate;
    return matchesSearch && matchesDate;
  });

  const filteredLongTerm = longTermMemories.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Date grouping
  const uniqueDates = [
    ...new Set(conversationMemories.map((m) => m.date)),
  ].sort((a, b) => b.localeCompare(a));

  const groupedByDate: Record<string, ConversationMemory[]> = {};
  for (const m of filteredConversation) {
    if (!groupedByDate[m.date]) groupedByDate[m.date] = [];
    groupedByDate[m.date].push(m);
  }
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="p-8 max-w-5xl">
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  const showForm = tab === "conversation" ? showConvForm : showLtForm;

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text">
            Memories
          </h2>
          <p className="text-text-secondary text-sm mt-1">
            {tab === "conversation"
              ? `${conversationMemories.length} conversation ${conversationMemories.length === 1 ? "memory" : "memories"}`
              : `${longTermMemories.length} long-term ${longTermMemories.length === 1 ? "memory" : "memories"}`}
          </p>
        </div>
        <button
          onClick={() =>
            tab === "conversation"
              ? setShowConvForm(!showConvForm)
              : setShowLtForm(!showLtForm)
          }
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          {showForm ? "Cancel" : "+ New Memory"}
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 bg-surface border border-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("conversation")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
            tab === "conversation"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text hover:bg-surface-hover"
          }`}
        >
          Conversations
          <span
            className={`text-xs ${tab === "conversation" ? "opacity-70" : "text-text-muted"}`}
          >
            {conversationMemories.length}
          </span>
        </button>
        <button
          onClick={() => setTab("longterm")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
            tab === "longterm"
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text hover:bg-surface-hover"
          }`}
        >
          Long-Term
          <span
            className={`text-xs ${tab === "longterm" ? "opacity-70" : "text-text-muted"}`}
          >
            {longTermMemories.length}
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search memories..."
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
        />
      </div>

      {/* Create forms */}
      {tab === "conversation" && showConvForm && (
        <form
          onSubmit={createConversationMemory}
          className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-4"
        >
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={convFormDate}
              onChange={(e) => setConvFormDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Title
            </label>
            <input
              value={convFormTitle}
              onChange={(e) => setConvFormTitle(e.target.value)}
              placeholder="What was discussed..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Content
            </label>
            <textarea
              value={convFormContent}
              onChange={(e) => setConvFormContent(e.target.value)}
              placeholder="Details and notes..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Tags (comma-separated, optional)
            </label>
            <input
              value={convFormTags}
              onChange={(e) => setConvFormTags(e.target.value)}
              placeholder="architecture, decision, preference"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowConvForm(false)}
              className="px-3 py-1.5 text-sm rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!convFormTitle || !convFormContent}
              className="px-4 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Save Memory
            </button>
          </div>
        </form>
      )}

      {tab === "longterm" && showLtForm && (
        <form
          onSubmit={createLongTermMemory}
          className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-4"
        >
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Title
            </label>
            <input
              value={ltFormTitle}
              onChange={(e) => setLtFormTitle(e.target.value)}
              placeholder="Important fact or preference..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Content
            </label>
            <textarea
              value={ltFormContent}
              onChange={(e) => setLtFormContent(e.target.value)}
              placeholder="Details..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">
              Category
            </label>
            <select
              value={ltFormCategory}
              onChange={(e) =>
                setLtFormCategory(e.target.value as LongTermMemoryCategory)
              }
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
            >
              <option value="preference">Preference</option>
              <option value="decision">Decision</option>
              <option value="fact">Fact</option>
              <option value="context">Context</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowLtForm(false)}
              className="px-3 py-1.5 text-sm rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!ltFormTitle || !ltFormContent}
              className="px-4 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Save Memory
            </button>
          </div>
        </form>
      )}

      {/* Conversation tab content */}
      {tab === "conversation" && (
        <>
          {/* Date filter row */}
          {uniqueDates.length > 0 && (
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedDate(null)}
                className={`px-3 py-1.5 text-xs rounded-md shrink-0 transition-colors ${
                  !selectedDate
                    ? "bg-accent text-white"
                    : "bg-surface border border-border text-text-secondary hover:text-text"
                }`}
              >
                All dates
              </button>
              {uniqueDates.map((date) => (
                <button
                  key={date}
                  onClick={() =>
                    setSelectedDate(selectedDate === date ? null : date)
                  }
                  className={`px-3 py-1.5 text-xs rounded-md shrink-0 transition-colors ${
                    selectedDate === date
                      ? "bg-accent text-white"
                      : "bg-surface border border-border text-text-secondary hover:text-text"
                  }`}
                >
                  {formatDateLabel(date)}
                </button>
              ))}
            </div>
          )}

          {/* Memory cards grouped by date */}
          {sortedDates.length === 0 ? (
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
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <p className="text-text-secondary text-sm">No memories yet</p>
              <p className="text-xs text-text-muted mt-1">
                Create a memory to start building your knowledge base
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((date) => (
                <div key={date}>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                    {formatDateLabel(date)}
                  </h3>
                  <div className="space-y-3">
                    {groupedByDate[date].map((memory) => (
                      <div
                        key={memory.id}
                        className="bg-surface border border-border rounded-lg p-5 hover:border-accent/30 transition-colors"
                      >
                        {editingId === memory.id ? (
                          <div className="space-y-3">
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                            />
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
                            />
                            <input
                              value={editTags}
                              onChange={(e) => setEditTags(e.target.value)}
                              placeholder="Tags (comma-separated)"
                              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveConvEdit(memory.id)}
                                className="px-2.5 py-1 text-xs rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-text mb-1">
                                {memory.title}
                              </h4>
                              <p className="text-xs text-text-secondary mb-2 whitespace-pre-wrap">
                                {memory.content}
                              </p>
                              {memory.tags.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap">
                                  {memory.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingId(memory.id);
                                  setEditTitle(memory.title);
                                  setEditContent(memory.content);
                                  setEditTags(memory.tags.join(", "));
                                }}
                                className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                              >
                                Edit
                              </button>
                              {confirmDelete === memory.id ? (
                                <>
                                  <button
                                    onClick={() => deleteConvMemory(memory.id)}
                                    className="px-2.5 py-1 text-xs rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setConfirmDelete(memory.id)}
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
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Long-term tab content */}
      {tab === "longterm" && (
        <>
          {/* Category filter */}
          {longTermMemories.length > 0 && (
            <div className="flex gap-1 mb-4 bg-surface border border-border rounded-lg p-1 w-fit">
              {(
                ["all", "preference", "decision", "fact", "context", "other"] as const
              ).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    categoryFilter === cat
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:text-text hover:bg-surface-hover"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {filteredLongTerm.length === 0 ? (
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
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <p className="text-text-secondary text-sm">No memories yet</p>
              <p className="text-xs text-text-muted mt-1">
                Create a long-term memory to store important facts
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLongTerm.map((memory) => (
                <div
                  key={memory.id}
                  className="bg-surface border border-border rounded-lg p-5 hover:border-accent/30 transition-colors"
                >
                  {editingId === memory.id ? (
                    <div className="space-y-3">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
                      />
                      <select
                        value={editCategory}
                        onChange={(e) =>
                          setEditCategory(
                            e.target.value as LongTermMemoryCategory
                          )
                        }
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                      >
                        <option value="preference">Preference</option>
                        <option value="decision">Decision</option>
                        <option value="fact">Fact</option>
                        <option value="context">Context</option>
                        <option value="other">Other</option>
                      </select>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveLtEdit(memory.id)}
                          className="px-2.5 py-1 text-xs rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-text">
                            {memory.title}
                          </h4>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${categoryBadge[memory.category] || categoryBadge.other}`}
                          >
                            {memory.category}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary whitespace-pre-wrap">
                          {memory.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingId(memory.id);
                            setEditTitle(memory.title);
                            setEditContent(memory.content);
                            setEditCategory(memory.category);
                          }}
                          className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                        >
                          Edit
                        </button>
                        {confirmDelete === memory.id ? (
                          <>
                            <button
                              onClick={() => deleteLtMemory(memory.id)}
                              className="px-2.5 py-1 text-xs rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(memory.id)}
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
        </>
      )}
    </div>
  );
}
