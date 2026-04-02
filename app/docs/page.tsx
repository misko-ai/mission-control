"use client";

import { useState, useEffect, useCallback } from "react";
import type { DocCategory, DocFormat, Doc } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/fetch";

const categoryBadge: Record<string, string> = {
  planning: "bg-accent/15 text-accent",
  newsletter: "bg-success/15 text-success",
  technical: "bg-warning/15 text-warning",
  research: "bg-text-muted/15 text-text-muted",
  draft: "bg-danger/15 text-danger",
  other: "bg-surface-hover text-text-secondary",
};

const formatBadge: Record<string, string> = {
  markdown: "bg-accent/10 text-accent",
  "plain text": "bg-surface-hover text-text-secondary",
  structured: "bg-success/10 text-success",
};

export default function DocsPage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<DocCategory>("other");
  const [formFormat, setFormFormat] = useState<DocFormat>("plain text");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<DocCategory>("other");
  const [editFormat, setEditFormat] = useState<DocFormat>("plain text");

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/docs");
      const data = await res.json();
      setDocs(data.docs || []);
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

  function renderMarkdown(text: string): string {
    let html = text
      // Code blocks first (before other processing)
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      // Inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // Headers
      .replace(/^#### (.+)$/gm, "<h4 class=\"text-xs font-semibold text-text mt-3 mb-1\">$1</h4>")
      .replace(/^### (.+)$/gm, "<h3 class=\"text-xs font-semibold text-text mt-3 mb-1\">$1</h3>")
      .replace(/^## (.+)$/gm, "<h2 class=\"text-sm font-semibold text-text mt-3 mb-1\">$1</h2>")
      .replace(/^# (.+)$/gm, "<h1 class=\"text-sm font-semibold text-text mt-3 mb-1\">$1</h1>")
      // Bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      // Blockquotes
      .replace(/^&gt; (.+)$/gm, "<blockquote class=\"border-l-2 border-border-subtle pl-3 my-1 text-xs text-text-secondary\">$1</blockquote>")
      // Unordered lists
      .replace(/^[\-\*] (.+)$/gm, "<li class=\"text-xs text-text-secondary ml-3\">$1</li>")
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-accent underline" target="_blank" rel="noopener">$1</a>')
      // Paragraphs
      .split(/\n\n+/)
      .map((block) => {
        block = block.trim();
        if (!block) return "";
        if (block.startsWith("<")) return block;
        // Convert single newlines within blocks to <br>
        return `<p class=\"text-xs text-text-secondary leading-relaxed mb-2\">${block.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");
    return html;
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard not available
    }
  }

  async function createDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle || !formContent) return;
    const result = await apiFetch("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formTitle,
        content: formContent,
        category: formCategory,
        format: formFormat,
      }),
    });
    if (!result.ok) { toast(result.error, "error"); return; }
    setFormTitle("");
    setFormContent("");
    setFormCategory("other");
    setFormFormat("plain text");
    setShowForm(false);
    fetchData();
  }

  async function saveEdit(id: string) {
    const result = await apiFetch("/api/docs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: editTitle,
        content: editContent,
        category: editCategory,
        format: editFormat,
      }),
    });
    if (!result.ok) { toast(result.error, "error"); return; }
    setEditingId(null);
    fetchData();
  }

  async function deleteDocument(id: string) {
    const result = await apiFetch(`/api/docs?id=${id}`, { method: "DELETE" });
    if (!result.ok) { toast(result.error, "error"); return; }
    setConfirmDelete(null);
    if (expandedId === id) setExpandedId(null);
    fetchData();
  }

  // Filtering
  const filtered = docs.filter((d) => {
    const matchesSearch =
      !searchQuery ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || d.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Sort most recent first
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

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
          <h2 className="text-2xl font-semibold tracking-tight text-text">Docs</h2>
          <p className="text-text-secondary text-sm mt-1">
            {docs.length} {docs.length === 1 ? "document" : "documents"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          {showForm ? "Cancel" : "+ New Doc"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={createDoc}
          className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-4"
        >
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Title</label>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Document title..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as DocCategory)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              >
                <option value="planning">Planning</option>
                <option value="newsletter">Newsletter</option>
                <option value="technical">Technical</option>
                <option value="research">Research</option>
                <option value="draft">Draft</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Format</label>
              <select
                value={formFormat}
                onChange={(e) => setFormFormat(e.target.value as DocFormat)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              >
                <option value="markdown">Markdown</option>
                <option value="plain text">Plain Text</option>
                <option value="structured">Structured</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Content</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Document content..."
              rows={8}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none font-mono"
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
              disabled={!formTitle || !formContent}
              className="px-4 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Save Doc
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search docs..."
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-lg p-1 w-fit">
        {(["all", "planning", "newsletter", "technical", "research", "draft", "other"] as const).map(
          (cat) => (
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
          )
        )}
      </div>

      {/* Doc list */}
      {sorted.length === 0 ? (
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p className="text-text-secondary text-sm">No docs yet</p>
          <p className="text-xs text-text-muted mt-1">
            Create a document to start building your library
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((doc) => (
            <div
              key={doc.id}
              className="bg-surface border border-border rounded-lg hover:border-accent/30 transition-colors"
            >
              {editingId === doc.id ? (
                <div className="p-5 space-y-3">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as DocCategory)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                    >
                      <option value="planning">Planning</option>
                      <option value="newsletter">Newsletter</option>
                      <option value="technical">Technical</option>
                      <option value="research">Research</option>
                      <option value="draft">Draft</option>
                      <option value="other">Other</option>
                    </select>
                    <select
                      value={editFormat}
                      onChange={(e) => setEditFormat(e.target.value as DocFormat)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                    >
                      <option value="markdown">Markdown</option>
                      <option value="plain text">Plain Text</option>
                      <option value="structured">Structured</option>
                    </select>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none font-mono"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveEdit(doc.id)}
                      className="px-2.5 py-1 text-xs rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Card header — always visible, clickable to expand */}
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === doc.id ? null : doc.id)
                    }
                    className="w-full text-left p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-medium text-text">
                            {doc.title}
                          </h3>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${categoryBadge[doc.category] || categoryBadge.other}`}
                          >
                            {doc.category}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${formatBadge[doc.format] || formatBadge["plain text"]}`}
                          >
                            {doc.format}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted">
                          Created {formatRelativeTime(doc.createdAt)}
                          {doc.updatedAt !== doc.createdAt &&
                            ` · Updated ${formatRelativeTime(doc.updatedAt)}`}
                        </p>
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
                          expandedId === doc.id ? "rotate-180" : ""
                        }`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {expandedId === doc.id && (
                    <div className="px-5 pb-5 border-t border-border-subtle">
                      <div className="pt-4 mb-4">
                        {doc.format === "markdown" ? (
                          <div
                            className="text-sm text-text-secondary bg-background rounded-md p-4 border border-border-subtle overflow-x-auto prose-xs"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }}
                          />
                        ) : (
                          <pre className="text-sm text-text-secondary whitespace-pre-wrap font-mono bg-background rounded-md p-4 border border-border-subtle overflow-x-auto">
                            {doc.content}
                          </pre>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(doc.content, doc.id);
                          }}
                          className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                        >
                          {copiedId === doc.id ? "Copied!" : "Copy"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(doc.id);
                            setEditTitle(doc.title);
                            setEditContent(doc.content);
                            setEditCategory(doc.category);
                            setEditFormat(doc.format);
                            setExpandedId(null);
                          }}
                          className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                        >
                          Edit
                        </button>
                        {confirmDelete === doc.id ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteDocument(doc.id);
                              }}
                              className="px-2.5 py-1 text-xs rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                            >
                              Confirm
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
                              setConfirmDelete(doc.id);
                            }}
                            className="px-2.5 py-1 text-xs rounded-md text-danger/70 hover:bg-danger/10 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
