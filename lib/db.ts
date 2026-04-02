import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { AppData } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const BACKUP_FILE = DATA_FILE + ".bak";
const TMP_FILE = DATA_FILE + ".tmp";
const NEXT_CACHE_DIR = path.join(process.cwd(), ".next");

const defaultData: AppData = {
  tools: [],
  activities: [],
  settings: {
    theme: "light",
    autoSave: true,
    logLevel: "normal",
  },
  tasks: [],
  taskActivities: [],
  taskRuns: [],
  scheduledEvents: [],
  projects: [],
  conversationMemories: [],
  longTermMemories: [],
  docs: [],
  team: { missionStatement: "", agents: [] },
  bugs: [],
};

// In-memory cache
let cache: AppData | null = null;

// Simple mutex for write serialization
let writePromise: Promise<void> = Promise.resolve();

// Validate .next cache on startup — if critical files are missing, clear it
// so Next.js can rebuild. This prevents server failures after crashes or
// power loss where .next cache ends up in a corrupt state.
async function validateNextCache(): Promise<void> {
  const criticalFiles = [
    path.join(NEXT_CACHE_DIR, "routes-manifest.json"),
    path.join(NEXT_CACHE_DIR, "build-manifest.json"),
    path.join(NEXT_CACHE_DIR, "prerender-manifest.json"),
  ];

  try {
    await Promise.all(criticalFiles.map((f) => fs.access(f)));
  } catch {
    // One or more critical files missing — .next cache is corrupt. Clear it
    // so Next.js rebuilds cleanly on the next request.
    console.warn("[MC] .next cache appears corrupt (missing critical files). Clearing...");
    try {
      await fs.rm(NEXT_CACHE_DIR, { recursive: true, force: true });
      console.warn("[MC] .next cache cleared. Next request will trigger a rebuild.");
    } catch {
      // Already gone or cannot remove — Next.js will handle it
    }
  }
}

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function applyDefaults(data: Record<string, unknown>): AppData {
  data.tasks ??= [];
  data.taskActivities ??= [];
  data.taskRuns ??= [];
  data.scheduledEvents ??= [];
  data.projects ??= [];
  data.conversationMemories ??= [];
  data.longTermMemories ??= [];
  data.docs ??= [];
  data.team ??= { missionStatement: "", agents: [] };
  (data.team as Record<string, unknown>).agents ??= [];
  data.bugs ??= [];

  // Task runs: apply artifact link defaults for backward compat
  for (const r of data.taskRuns as Record<string, unknown>[]) {
    r.linkedBugIds ??= [];
    r.linkedProjectIds ??= [];
    r.linkedDocIds ??= [];
  }

  // Backfill run↔project links from project.linkedTaskIds
  const projectList = data.projects as Array<Record<string, unknown>>;
  const runList = data.taskRuns as Array<Record<string, unknown>>;
  for (const project of projectList) {
    const taskIds = (project.linkedTaskIds as string[]) || [];
    for (const run of runList) {
      if (
        taskIds.includes(run.taskId as string) &&
        !(run.linkedProjectIds as string[]).includes(project.id as string)
      ) {
        (run.linkedProjectIds as string[]).push(project.id as string);
      }
    }
  }

  // Projects v2: apply defaults to each project for backward compat
  for (const p of data.projects as Record<string, unknown>[]) {
    p.goal ??= "";
    p.desiredOutcome ??= "";
    p.successCriteria ??= [];
    p.constraints ??= [];
    p.assumptions ??= [];
    p.priority ??= "medium";
    p.type ??= "other";
    p.owner ??= "user";
    p.planningState ??= "not-started";
    p.linkedDocIds ??= [];
    p.linkedMemoryIds ??= [];
    p.linkedCalendarEventIds ??= [];
    p.linkedBugIds ??= [];
    p.milestones ??= [];
    p.suggestedTasks ??= [];
    p.planningNotes ??= "";
    p.executionMode ??= "manual";
  }

  return data as unknown as AppData;
}

export async function getData(): Promise<AppData> {
  if (cache) return cache;

  // On first call, validate the .next cache so the server can start cleanly
  // even if the cache was left corrupt by a previous crash or hard kill.
  await validateNextCache();

  await ensureDataFile();
  let data: AppData;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    data = applyDefaults(JSON.parse(raw));
  } catch (err) {
    console.error("[MC] Failed to parse store.json, attempting backup recovery:", err);
    try {
      const backupRaw = await fs.readFile(BACKUP_FILE, "utf-8");
      data = applyDefaults(JSON.parse(backupRaw));
      console.warn("[MC] Recovered from store.json.bak");
    } catch {
      console.warn("[MC] No valid backup found, using defaults");
      data = { ...defaultData };
    }
  }

  const source = data === defaultData ? "defaults" : "store.json";
  const counts = {
    tasks: (data.tasks || []).length,
    projects: (data.projects || []).length,
    docs: (data.docs || []).length,
    bugs: (data.bugs || []).length,
    memories: (data.conversationMemories || []).length + (data.longTermMemories || []).length,
    events: (data.scheduledEvents || []).length,
    tools: (data.tools || []).length,
  };
  console.log(`[MC] Store loaded from ${source}:`, counts);

  cache = data;
  return data;
}

export async function saveData(data: AppData): Promise<void> {
  cache = data;

  // Serialize writes to prevent corruption
  writePromise = writePromise.then(async () => {
    // Backup current file before writing
    try {
      await fs.copyFile(DATA_FILE, BACKUP_FILE);
    } catch {
      // First write or missing file -- no backup to make
    }
    // Atomic write: write to tmp then rename
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(TMP_FILE, json);
    await fs.rename(TMP_FILE, DATA_FILE);
  });

  await writePromise;
}

export function clearCache(): void {
  cache = null;
}

export function generateId(): string {
  return crypto.randomUUID();
}
