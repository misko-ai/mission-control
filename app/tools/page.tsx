"use client";

import { useState, useEffect } from "react";

interface Parameter {
  name: string;
  type: "string" | "number" | "boolean" | "json";
  description: string;
  required: boolean;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Parameter[];
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [paramInputs, setParamInputs] = useState<Parameter[]>([
    { name: "", type: "string", description: "", required: true },
  ]);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);

  useEffect(() => {
    fetchTools();
  }, []);

  async function fetchTools() {
    try {
      const res = await fetch("/api/tools");
      const data = await res.json();
      setTools(data.tools || []);
    } catch {
      setError("Failed to load tools");
    }
  }

  function openCreateForm() {
    setEditingTool(null);
    setFormData({ name: "", description: "" });
    setParamInputs([{ name: "", type: "string", description: "", required: true }]);
    setError("");
    setShowForm(true);
  }

  function openEditForm(tool: Tool) {
    setEditingTool(tool);
    setFormData({ name: tool.name, description: tool.description });
    setParamInputs(
      tool.parameters.length > 0
        ? [...tool.parameters]
        : [{ name: "", type: "string", description: "", required: true }]
    );
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingTool(null);
    setError("");
  }

  function addParam() {
    setParamInputs([...paramInputs, { name: "", type: "string", description: "", required: true }]);
  }

  function removeParam(index: number) {
    setParamInputs(paramInputs.filter((_, i) => i !== index));
  }

  function updateParam(index: number, field: keyof Parameter, value: string | boolean) {
    const updated = [...paramInputs];
    updated[index] = { ...updated[index], [field]: value };
    setParamInputs(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validParams = paramInputs.filter((p) => p.name.trim() !== "");

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      parameters: validParams,
    };

    try {
      const res = editingTool
        ? await fetch("/api/tools", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingTool.id, ...payload }),
          })
        : await fetch("/api/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        closeForm();
        fetchTools();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save tool");
      }
    } catch {
      setError("Failed to save tool");
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tools?id=${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    fetchTools();
  }

  async function handleExecute(tool: Tool) {
    setExecuting(tool.id);
    try {
      await fetch("/api/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tool.id }),
      });
      fetchTools();
    } finally {
      setExecuting(null);
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text">Tools</h2>
          <p className="text-text-secondary text-sm mt-1">
            {tools.length === 0
              ? "Build and manage your custom tools"
              : `${tools.length} tool${tools.length !== 1 ? "s" : ""} registered`}
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm rounded-md transition-colors"
        >
          <PlusIcon />
          New Tool
        </button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-lg p-6 mb-6"
        >
          <h3 className="text-sm font-medium text-text mb-4">
            {editingTool ? "Edit Tool" : "Create New Tool"}
          </h3>
          {error && (
            <p className="text-danger text-sm mb-4 bg-danger/10 px-3 py-2 rounded-md border border-danger/20">
              {error}
            </p>
          )}
          <div className="space-y-5">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Tool Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:border-accent transition-colors"
                placeholder="My Awesome Tool"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:border-accent transition-colors resize-none"
                placeholder="What does this tool do?"
                rows={2}
                required
              />
            </div>

            {/* Per-row Parameters UI */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-text-secondary">Parameters</label>
                <button
                  type="button"
                  onClick={addParam}
                  className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
                >
                  <PlusIcon /> Add parameter
                </button>
              </div>
              {paramInputs.length > 0 ? (
                <div className="space-y-2">
                  {paramInputs.map((param, i) => (
                    <div key={i} className="flex gap-2 items-start bg-background border border-border rounded-md p-2">
                      <input
                        type="text"
                        value={param.name}
                        onChange={(e) => updateParam(i, "name", e.target.value)}
                        className="flex-1 bg-surface border border-border rounded px-2 py-1.5 text-sm text-text placeholder-text-muted"
                        placeholder="param_name"
                      />
                      <select
                        value={param.type}
                        onChange={(e) => updateParam(i, "type", e.target.value)}
                        className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-text"
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="json">json</option>
                      </select>
                      <label className="flex items-center gap-1.5 py-1.5 text-xs text-text-secondary shrink-0">
                        <input
                          type="checkbox"
                          checked={param.required}
                          onChange={(e) => updateParam(i, "required", e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-accent"
                        />
                        required
                      </label>
                      <input
                        type="text"
                        value={param.description}
                        onChange={(e) => updateParam(i, "description", e.target.value)}
                        className="flex-[2] bg-surface border border-border rounded px-2 py-1.5 text-sm text-text placeholder-text-muted"
                        placeholder="Description..."
                      />
                      <button
                        type="button"
                        onClick={() => removeParam(i)}
                        className="text-text-muted hover:text-danger transition-colors py-1.5 px-1 shrink-0"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted py-2">No parameters — tool takes no input</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-md transition-colors"
              >
                {editingTool ? "Save Changes" : "Create Tool"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 bg-surface-hover hover:bg-border text-text-secondary text-sm rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tool List */}
      {tools.length > 0 ? (
        <div className="space-y-3">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="bg-surface border border-border rounded-lg p-5 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="text-sm font-medium text-text">{tool.name}</h4>
                    {tool.parameters.length === 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-border">
                        no params
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{tool.description}</p>

                  {tool.parameters.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tool.parameters.map((param, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded border border-border bg-background"
                        >
                          <span className="text-accent font-medium">{param.name}</span>
                          <span className="text-text-muted">:</span>
                          <span className="text-text-secondary">{param.type}</span>
                          {param.required && <span className="text-danger ml-0.5">*</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-text-muted mt-2">
                    Created {new Date(tool.createdAt).toLocaleDateString()}
                    {tool.lastUsed && ` · Last used ${formatRelativeTime(tool.lastUsed)}`}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-text-secondary">
                      <span className="text-text font-medium">{tool.usageCount}</span> run{tool.usageCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Execute button */}
                    <button
                      onClick={() => handleExecute(tool)}
                      disabled={executing === tool.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-success/15 text-success hover:bg-success/25 transition-colors disabled:opacity-50"
                      title="Execute tool"
                    >
                      <PlayIcon />
                      {executing === tool.id ? "Running..." : "Run"}
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => openEditForm(tool)}
                      className="p-1.5 text-text-muted hover:text-accent hover:bg-surface-hover rounded transition-colors"
                      title="Edit tool"
                    >
                      <EditIcon />
                    </button>

                    {/* Delete — with inline confirm */}
                    {deleteConfirm === tool.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(tool.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
                        >
                          <CheckIcon /> Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-1.5 text-text-muted hover:text-text hover:bg-surface-hover rounded transition-colors"
                        >
                          <CloseIcon />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(tool.id)}
                        className="p-1.5 text-text-muted hover:text-danger hover:bg-surface-hover rounded transition-colors"
                        title="Delete tool"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-hover mb-4">
            <ToolsIcon />
          </div>
          <p className="text-text-secondary">No tools yet</p>
          <p className="text-xs text-text-muted mt-1 mb-4">Create your first tool to get started</p>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-md transition-colors"
          >
            <PlusIcon /> Create First Tool
          </button>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
