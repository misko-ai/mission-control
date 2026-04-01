"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentRole, AgentStatus, Agent } from "@/lib/types";

const roleBadge: Record<AgentRole, string> = {
  orchestrator: "bg-accent/15 text-accent",
  worker: "bg-success/15 text-success",
  specialist: "bg-warning/15 text-warning",
};

const statusDot: Record<AgentStatus, string> = {
  running: "bg-success",
  idle: "bg-warning",
  offline: "bg-text-muted",
};

const statusLabel: Record<AgentStatus, string> = {
  running: "Running",
  idle: "Idle",
  offline: "Offline",
};

export default function TeamPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [missionStatement, setMissionStatement] = useState("");
  const [loading, setLoading] = useState(true);

  // Mission editing
  const [editingMission, setEditingMission] = useState(false);
  const [missionDraft, setMissionDraft] = useState("");

  // Agent form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<AgentRole>("worker");
  const [formDescription, setFormDescription] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formParentId, setFormParentId] = useState<string>("");
  const [formStatus, setFormStatus] = useState<AgentStatus>("idle");

  // Agent edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<AgentRole>("worker");
  const [editDescription, setEditDescription] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");
  const [editStatus, setEditStatus] = useState<AgentStatus>("idle");

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, missionRes] = await Promise.all([
        fetch("/api/team/agents"),
        fetch("/api/team/mission"),
      ]);
      const agentsData = await agentsRes.json();
      const missionData = await missionRes.json();
      setAgents(agentsData.agents || []);
      setMissionStatement(missionData.missionStatement || "");
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

  // Mission CRUD

  async function saveMission() {
    await fetch("/api/team/mission", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missionStatement: missionDraft }),
    });
    setEditingMission(false);
    fetchData();
  }

  // Agent CRUD

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!formName || !formRole) return;
    await fetch("/api/team/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        role: formRole,
        description: formDescription,
        model: formModel,
        parentId: formParentId || null,
        status: formStatus,
      }),
    });
    setFormName("");
    setFormRole("worker");
    setFormDescription("");
    setFormModel("");
    setFormParentId("");
    setFormStatus("idle");
    setShowForm(false);
    fetchData();
  }

  async function saveAgentEdit(id: string) {
    await fetch("/api/team/agents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: editName,
        role: editRole,
        description: editDescription,
        model: editModel,
        parentId: editParentId || null,
        status: editStatus,
      }),
    });
    setEditingId(null);
    fetchData();
  }

  async function deleteAgentById(id: string) {
    await fetch(`/api/team/agents?id=${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchData();
  }

  // Build hierarchy tree

  function buildTree(parentId: string | null): Agent[] {
    return agents
      .filter((a) => a.parentId === parentId)
      .sort((a, b) => {
        const roleOrder: Record<AgentRole, number> = {
          orchestrator: 0,
          specialist: 1,
          worker: 2,
        };
        return roleOrder[a.role] - roleOrder[b.role];
      });
  }

  function renderAgent(agent: Agent, depth: number) {
    const children = buildTree(agent.id);

    return (
      <div key={agent.id} style={{ marginLeft: depth * 24 }}>
        <div className="bg-surface border border-border rounded-lg p-5 mb-3 hover:border-accent/30 transition-colors">
          {editingId === agent.id ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as AgentRole)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                  >
                    <option value="orchestrator">Orchestrator</option>
                    <option value="specialist">Specialist</option>
                    <option value="worker">Worker</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Description</label>
                <input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Model</label>
                  <input
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Reports to</label>
                  <select
                    value={editParentId}
                    onChange={(e) => setEditParentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                  >
                    <option value="">None (top-level)</option>
                    {agents
                      .filter((a) => a.id !== agent.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AgentStatus)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                  >
                    <option value="running">Running</option>
                    <option value="idle">Idle</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveAgentEdit(agent.id)}
                  className="px-2.5 py-1 text-xs rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot[agent.status]}`} />
                  <h3 className="text-sm font-medium text-text">{agent.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${roleBadge[agent.role]}`}>
                    {agent.role}
                  </span>
                  <span className="text-xs text-text-muted">
                    {statusLabel[agent.status]}
                  </span>
                </div>
                {agent.description && (
                  <p className="text-xs text-text-secondary mb-1">{agent.description}</p>
                )}
                {agent.model && (
                  <p className="text-xs text-text-muted">
                    Model: <span className="text-text-secondary">{agent.model}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setEditingId(agent.id);
                    setEditName(agent.name);
                    setEditRole(agent.role);
                    setEditDescription(agent.description);
                    setEditModel(agent.model);
                    setEditParentId(agent.parentId || "");
                    setEditStatus(agent.status);
                  }}
                  className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  Edit
                </button>
                {confirmDelete === agent.id ? (
                  <>
                    <button
                      onClick={() => deleteAgentById(agent.id)}
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
                    onClick={() => setConfirmDelete(agent.id)}
                    className="px-2.5 py-1 text-xs rounded-md text-danger/70 hover:bg-danger/10 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {children.map((child) => renderAgent(child, depth + 1))}
      </div>
    );
  }

  const rootAgents = buildTree(null);

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
          <h2 className="text-2xl font-semibold tracking-tight text-text">Team</h2>
          <p className="text-text-secondary text-sm mt-1">
            {agents.length} {agents.length === 1 ? "agent" : "agents"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Agent"}
        </button>
      </div>

      {/* Mission Statement */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide">
            Mission Statement
          </h3>
          {!editingMission && (
            <button
              onClick={() => {
                setEditingMission(true);
                setMissionDraft(missionStatement);
              }}
              className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
            >
              {missionStatement ? "Edit" : "Set Mission"}
            </button>
          )}
        </div>
        {editingMission ? (
          <div className="space-y-3">
            <textarea
              value={missionDraft}
              onChange={(e) => setMissionDraft(e.target.value)}
              placeholder="Define the north star every agent works toward..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingMission(false)}
                className="px-2.5 py-1 text-xs rounded-md text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveMission}
                className="px-2.5 py-1 text-xs rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : missionStatement ? (
          <p className="text-sm text-text">{missionStatement}</p>
        ) : (
          <p className="text-sm text-text-muted italic">
            No mission statement set. Define the north star every agent works toward.
          </p>
        )}
      </div>

      {/* Create agent form */}
      {showForm && (
        <form
          onSubmit={createAgent}
          className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Agent name..."
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Role</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as AgentRole)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              >
                <option value="orchestrator">Orchestrator</option>
                <option value="specialist">Specialist</option>
                <option value="worker">Worker</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Description</label>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="What does this agent do..."
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Model / Device</label>
              <input
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                placeholder="e.g. Claude Opus 4"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Reports to</label>
              <select
                value={formParentId}
                onChange={(e) => setFormParentId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              >
                <option value="">None (top-level)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as AgentStatus)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text"
              >
                <option value="running">Running</option>
                <option value="idle">Idle</option>
                <option value="offline">Offline</option>
              </select>
            </div>
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
              disabled={!formName}
              className="px-4 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Add Agent
            </button>
          </div>
        </form>
      )}

      {/* Org chart heading */}
      <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
        Org Structure
      </h3>

      {/* Agent hierarchy */}
      {agents.length === 0 ? (
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
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p className="text-text-secondary text-sm">No agents yet</p>
          <p className="text-xs text-text-muted mt-1">
            Add your first agent to build the team structure
          </p>
        </div>
      ) : (
        <div>{rootAgents.map((agent) => renderAgent(agent, 0))}</div>
      )}
    </div>
  );
}
