"use client";

import { useState, useEffect, useCallback } from "react";

type AgentRole = "orchestrator" | "worker" | "specialist";
type AgentStatus = "running" | "idle" | "offline";

interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  model: string;
  parentId: string | null;
  status: AgentStatus;
}

// Pixel size unit
const PX = 4;

// Agent body colors by role
const agentColors: Record<AgentRole, { body: string; head: string }> = {
  orchestrator: { body: "#7B7FEB", head: "#9B9FF0" },
  specialist: { body: "#F59E0B", head: "#FBBF24" },
  worker: { body: "#22C55E", head: "#4ADE80" },
};

// Desk positions in a 2-row office layout (in pixel grid coords)
const deskSlots = [
  { x: 3, y: 3 },
  { x: 13, y: 3 },
  { x: 23, y: 3 },
  { x: 33, y: 3 },
  { x: 3, y: 13 },
  { x: 13, y: 13 },
  { x: 23, y: 13 },
  { x: 33, y: 13 },
];

// Water cooler position
const waterCooler = { x: 43, y: 8 };

function PixelBlock({
  x,
  y,
  w,
  h,
  color,
  className,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        position: "absolute",
        left: x * PX,
        top: y * PX,
        width: w * PX,
        height: h * PX,
        backgroundColor: color,
        imageRendering: "pixelated",
      }}
    />
  );
}

function Desk({ x, y }: { x: number; y: number }) {
  return (
    <>
      {/* Desk surface */}
      <PixelBlock x={x} y={y + 4} w={8} h={3} color="#8B6F47" />
      {/* Desk legs */}
      <PixelBlock x={x} y={y + 7} w={1} h={2} color="#6B5235" />
      <PixelBlock x={x + 7} y={y + 7} w={1} h={2} color="#6B5235" />
      {/* Monitor stand */}
      <PixelBlock x={x + 3} y={y + 3} w={2} h={1} color="#555" />
      {/* Monitor */}
      <PixelBlock x={x + 1} y={y} w={6} h={3} color="#333" />
      {/* Screen */}
      <PixelBlock x={x + 2} y={y + 0.5} w={4} h={2} color="#1a1a2e" className="animate-screen-flicker" />
      {/* Chair */}
      <PixelBlock x={x + 2} y={y + 9} w={4} h={2} color="#555" />
      <PixelBlock x={x + 3} y={y + 8} w={2} h={1} color="#444" />
    </>
  );
}

function AgentSprite({
  agent,
  x,
  y,
  atDesk,
  onClick,
}: {
  agent: Agent;
  x: number;
  y: number;
  atDesk: boolean;
  onClick: () => void;
}) {
  const colors = agentColors[agent.role];
  const spriteX = atDesk ? x + 2 : x;
  const spriteY = atDesk ? y + 6 : y;

  return (
    <div
      data-agent-id={agent.id}
      data-agent-name={agent.name}
      data-agent-status={agent.status}
      className={`cursor-pointer ${
        atDesk ? "animate-pixel-typing" : "animate-pixel-idle"
      }`}
      style={{
        position: "absolute",
        left: spriteX * PX,
        top: spriteY * PX,
        width: 4 * PX,
        height: 6 * PX,
        zIndex: 10,
      }}
      onClick={onClick}
    >
      {/* Head */}
      <div
        style={{
          position: "absolute",
          left: 0.5 * PX,
          top: 0,
          width: 3 * PX,
          height: 3 * PX,
          backgroundColor: colors.head,
          borderRadius: PX,
        }}
      />
      {/* Eyes */}
      <div
        style={{
          position: "absolute",
          left: 1 * PX,
          top: 1 * PX,
          width: PX * 0.6,
          height: PX * 0.6,
          backgroundColor: "#1a1a2e",
          borderRadius: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 2.4 * PX,
          top: 1 * PX,
          width: PX * 0.6,
          height: PX * 0.6,
          backgroundColor: "#1a1a2e",
          borderRadius: 1,
        }}
      />
      {/* Body */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 3 * PX,
          width: 4 * PX,
          height: 3 * PX,
          backgroundColor: colors.body,
          borderRadius: `0 0 ${PX}px ${PX}px`,
        }}
      />
      {/* Name tag */}
      <div
        className="text-center whitespace-nowrap pointer-events-none"
        style={{
          position: "absolute",
          top: -3.5 * PX,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 9,
          fontWeight: 600,
          color: colors.body,
          textShadow: "0 0 3px rgba(255,255,255,0.9)",
          lineHeight: 1,
        }}
      >
        {agent.name}
      </div>
      {/* Status dot */}
      <div
        style={{
          position: "absolute",
          top: -1 * PX,
          right: -1 * PX,
          width: PX * 1.5,
          height: PX * 1.5,
          borderRadius: "50%",
          backgroundColor:
            agent.status === "running"
              ? "#22C55E"
              : agent.status === "idle"
                ? "#F59E0B"
                : "#9090A8",
          border: "1px solid white",
        }}
      />
    </div>
  );
}

function WaterCooler({ x, y }: { x: number; y: number }) {
  return (
    <>
      {/* Body */}
      <PixelBlock x={x} y={y + 2} w={3} h={5} color="#B0D4F1" />
      {/* Top tank */}
      <PixelBlock x={x + 0.5} y={y} w={2} h={2} color="#87CEEB" />
      {/* Base */}
      <PixelBlock x={x - 0.5} y={y + 7} w={4} h={1} color="#777" />
      {/* Steam/bubbles */}
      <div
        className="animate-steam"
        style={{
          position: "absolute",
          left: (x + 1) * PX,
          top: (y - 1) * PX,
          width: PX,
          height: PX,
          borderRadius: "50%",
          backgroundColor: "rgba(135, 206, 235, 0.5)",
        }}
      />
      {/* Label */}
      <div
        className="whitespace-nowrap"
        style={{
          position: "absolute",
          top: (y + 8.5) * PX,
          left: (x + 1.5) * PX,
          transform: "translateX(-50%)",
          fontSize: 8,
          color: "#9090A8",
          fontWeight: 500,
        }}
      >
        Water Cooler
      </div>
    </>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <>
      {/* Pot */}
      <PixelBlock x={x} y={y + 2} w={2} h={2} color="#B5651D" />
      {/* Leaves */}
      <PixelBlock x={x - 0.5} y={y} w={3} h={2} color="#2D8B46" />
      <PixelBlock x={x} y={y - 1} w={2} h={1} color="#34A853" />
    </>
  );
}

function FloorTile({ x, y, dark }: { x: number; y: number; dark: boolean }) {
  return (
    <PixelBlock
      x={x}
      y={y}
      w={5}
      h={5}
      color={dark ? "#E8E5DF" : "#F0EDE7"}
    />
  );
}

export default function OfficePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/team/agents");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Keep selected agent in sync with live data
  useEffect(() => {
    if (selectedAgent) {
      const updated = agents.find((a) => a.id === selectedAgent.id);
      if (updated) setSelectedAgent(updated);
      else setSelectedAgent(null);
    }
  }, [agents, selectedAgent]);

  const visibleAgents = agents.filter((a) => a.status !== "offline");
  const offlineAgents = agents.filter((a) => a.status === "offline");

  // Office grid dimensions
  const officeW = 50;
  const officeH = 24;

  if (loading) {
    return (
      <div className="p-8 max-w-5xl">
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-text">
          Office
        </h2>
        <p className="text-text-secondary text-sm mt-1">
          {visibleAgents.length} in office
          {offlineAgents.length > 0 &&
            ` · ${offlineAgents.length} offline`}
        </p>
      </div>

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
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <p className="text-text-secondary text-sm">Office is empty</p>
          <p className="text-xs text-text-muted mt-1">
            Add agents on the Team page to populate the office
          </p>
        </div>
      ) : (
        <div className="flex gap-6 items-start flex-wrap">
          {/* Office floor */}
          <div
            className="bg-surface border border-border rounded-lg relative overflow-hidden shrink-0"
            style={{
              width: officeW * PX + 16,
              height: officeH * PX + 16,
              padding: 8,
            }}
          >
            {/* Checkerboard floor tiles */}
            {Array.from({ length: Math.ceil(officeH / 5) }).map((_, row) =>
              Array.from({ length: Math.ceil(officeW / 5) }).map((_, col) => (
                <FloorTile
                  key={`${row}-${col}`}
                  x={col * 5}
                  y={row * 5}
                  dark={(row + col) % 2 === 0}
                />
              ))
            )}

            {/* Wall */}
            <PixelBlock x={0} y={0} w={officeW} h={0.5} color="#D0D3DE" />

            {/* Desks */}
            {deskSlots.map((slot, i) => (
              <Desk key={i} x={slot.x} y={slot.y} />
            ))}

            {/* Water cooler */}
            <WaterCooler x={waterCooler.x} y={waterCooler.y} />

            {/* Plants */}
            <Plant x={0.5} y={1} />
            <Plant x={officeW - 3} y={1} />
            <Plant x={officeW - 3} y={20} />

            {/* Agents at desks or wandering */}
            {visibleAgents.map((agent, i) => {
              const deskIndex = i % deskSlots.length;
              const atDesk = agent.status === "running";
              const desk = deskSlots[deskIndex];

              // Idle agents wander near the water cooler
              const idleX = waterCooler.x - 5 + (i % 3) * 4;
              const idleY = waterCooler.y + (i % 2) * 5;

              return (
                <AgentSprite
                  key={agent.id}
                  agent={agent}
                  x={atDesk ? desk.x : idleX}
                  y={atDesk ? desk.y : idleY}
                  atDesk={atDesk}
                  onClick={() => setSelectedAgent(agent)}
                />
              );
            })}
          </div>

          {/* Info panel */}
          <div className="flex-1 min-w-[220px] max-w-xs space-y-4">
            {/* Selected agent detail */}
            {selectedAgent ? (
              <div className="bg-surface border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        agentColors[selectedAgent.role].body,
                    }}
                  />
                  <h3 className="text-sm font-medium text-text">
                    {selectedAgent.name}
                  </h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      selectedAgent.status === "running"
                        ? "bg-success/15 text-success"
                        : selectedAgent.status === "idle"
                          ? "bg-warning/15 text-warning"
                          : "bg-surface-hover text-text-muted"
                    }`}
                  >
                    {selectedAgent.status}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-text-muted">Role: </span>
                    <span className="text-text-secondary">{selectedAgent.role}</span>
                  </div>
                  {selectedAgent.description && (
                    <div>
                      <span className="text-text-muted">Task: </span>
                      <span className="text-text-secondary">
                        {selectedAgent.description}
                      </span>
                    </div>
                  )}
                  {selectedAgent.model && (
                    <div>
                      <span className="text-text-muted">Model: </span>
                      <span className="text-text-secondary">{selectedAgent.model}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-text-muted">Location: </span>
                    <span className="text-text-secondary">
                      {selectedAgent.status === "running"
                        ? "At desk"
                        : selectedAgent.status === "idle"
                          ? "Water cooler"
                          : "Away"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="mt-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-lg p-5 text-center">
                <p className="text-xs text-text-muted">
                  Click an agent to inspect
                </p>
              </div>
            )}

            {/* Legend */}
            <div className="bg-surface border border-border rounded-lg p-4">
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                Legend
              </h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-success" />
                  <span className="text-xs text-text-secondary">Running — at desk, working</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-warning" />
                  <span className="text-xs text-text-secondary">Idle — at the water cooler</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#9090A8" }} />
                  <span className="text-xs text-text-secondary">Offline — not in office</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border-subtle space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: agentColors.orchestrator.body }} />
                  <span className="text-xs text-text-secondary">Orchestrator</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: agentColors.specialist.body }} />
                  <span className="text-xs text-text-secondary">Specialist</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: agentColors.worker.body }} />
                  <span className="text-xs text-text-secondary">Worker</span>
                </div>
              </div>
            </div>

            {/* Offline agents list */}
            {offlineAgents.length > 0 && (
              <div className="bg-surface border border-border rounded-lg p-4">
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                  Offline
                </h4>
                <div className="space-y-1.5">
                  {offlineAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-surface-hover rounded px-1.5 py-1 -mx-1.5 transition-colors"
                      onClick={() => setSelectedAgent(agent)}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: "#9090A8" }}
                      />
                      <span className="text-xs text-text-secondary">
                        {agent.name}
                      </span>
                      <span className="text-xs text-text-muted ml-auto">
                        {agent.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
