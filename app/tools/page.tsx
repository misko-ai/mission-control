"use client";

import { useState, useEffect } from "react";
import type { Parameter, Tool } from "@/lib/types";
import { PlusIcon, CloseIcon, TrashIcon, EditIcon, CheckIcon, PlayIcon, ToolsIcon } from "@/components/icons";
import { formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/fetch";

export default function ToolsPage() {
  const { toast } = useToast();
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
    const result = await apiFetch(`/api/tools?id=${id}`, { method: "DELETE" });
    if (!result.ok) { toast(result.error, "error"); return; }
    setDeleteConfirm(null);
    fetchTools();
  }

  async function handleExecute(tool: Tool) {
    setExecuting(tool.id);
    try {
      const result = await apiFetch("/api/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tool.id }),
      });
      if (!result.ok) { toast(result.error, "error"); }
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
            <ToolsIcon size={20} className="text-text-secondary" />
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


