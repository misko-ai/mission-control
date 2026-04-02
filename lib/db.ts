import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { AppData } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const BACKUP_FILE = DATA_FILE + ".bak";
const TMP_FILE = DATA_FILE + ".tmp";
const SENTINEL_FILE = path.join(DATA_DIR, ".initialized");
const NEXT_CACHE_DIR = path.join(process.cwd(), ".next");

// Recovery tracking — set during getData, exported for health endpoint
export type RecoverySource = "store" | "backup" | "tmp-recovery" | "first-boot";
let recoverySource: RecoverySource = "store";
let recoveryWarning: string | null = null;

export function getRecoverySource(): RecoverySource {
  return recoverySource;
}

export function getRecoveryWarning(): string | null {
  return recoveryWarning;
}

export class DataCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataCorruptionError";
  }
}

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

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function sentinelExists(): Promise<boolean> {
  return fileExists(SENTINEL_FILE);
}

async function writeSentinel(): Promise<void> {
  try {
    await fs.writeFile(SENTINEL_FILE, new Date().toISOString());
  } catch {
    // Best effort — sentinel is a safety net, not critical path
  }
}

/** Durable write: write to file, fsync, close. */
async function durableWrite(filePath: string, content: string): Promise<void> {
  const fh = await fs.open(filePath, "w");
  try {
    await fh.writeFile(content);
    await fh.sync();
  } finally {
    await fh.close();
  }
}

/** fsync a directory to ensure rename/link entries are durable. */
async function fsyncDir(dirPath: string): Promise<void> {
  const dh = await fs.open(dirPath, "r");
  try {
    await dh.sync();
  } finally {
    await dh.close();
  }
}

/** Try to parse a JSON file as AppData. Returns null on any failure. */
async function tryLoadFile(filePath: string): Promise<AppData | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return applyDefaults(JSON.parse(raw));
  } catch {
    return null;
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

  await ensureDataDir();

  // Crash-recovery load order:
  // 1. TMP_FILE exists → crash during write; it was fsynced, try it first
  // 2. DATA_FILE → normal path
  // 3. BACKUP_FILE → primary was corrupted/missing
  // 4. Sentinel exists but nothing loadable → DataCorruptionError (fail closed)
  // 5. No sentinel → genuine first boot, use defaults

  let data: AppData | null = null;

  // 1. Check for crash-recovery tmp file
  const tmpData = await tryLoadFile(TMP_FILE);
  if (tmpData) {
    // TMP_FILE exists and is valid — a write was interrupted after fsync but
    // before rename completed. Promote it to primary.
    console.warn("[MC] Found valid tmp file from interrupted write, recovering...");
    try {
      await fs.rename(TMP_FILE, DATA_FILE);
      await fsyncDir(DATA_DIR);
    } catch {
      // Rename failed — we still have the data in memory, continue
    }
    data = tmpData;
    recoverySource = "tmp-recovery";
    recoveryWarning = "Recovered from interrupted write (tmp file)";
  }

  // 2. Try primary store
  if (!data) {
    data = await tryLoadFile(DATA_FILE);
    if (data) {
      recoverySource = "store";
      recoveryWarning = null;
    }
  }

  // 3. Try backup
  if (!data) {
    data = await tryLoadFile(BACKUP_FILE);
    if (data) {
      console.warn("[MC] Recovered from store.json.bak");
      recoverySource = "backup";
      recoveryWarning = "Recovered from backup — store.json was corrupted or missing";
      // Restore primary from backup
      try {
        const json = JSON.stringify(data, null, 2);
        await durableWrite(DATA_FILE, json);
        await fsyncDir(DATA_DIR);
      } catch {
        // Best effort restore — we have data in memory
      }
    }
  }

  // 4. Nothing loadable — check if this is data loss or first boot
  if (!data) {
    const hasSentinel = await sentinelExists();
    if (hasSentinel) {
      // Sentinel exists = this installation had real data. All files gone/corrupt = data loss.
      const msg =
        "[MC] FATAL: store.json, store.json.bak, and store.json.tmp are all missing or corrupt, " +
        "but sentinel (.initialized) exists. This is data loss, not a first boot. " +
        "Refusing to start with empty defaults.";
      console.error(msg);
      throw new DataCorruptionError(msg);
    }
    // Genuine first boot — no sentinel, no data files
    console.log("[MC] First boot — initializing with defaults");
    data = { ...defaultData };
    recoverySource = "first-boot";
    recoveryWarning = null;
    // Write initial store and sentinel
    const json = JSON.stringify(data, null, 2);
    await durableWrite(DATA_FILE, json);
    await fsyncDir(DATA_DIR);
    await writeSentinel();
  }

  // Clean up stale tmp file if it still exists (normal boot path)
  if (recoverySource !== "tmp-recovery") {
    try {
      await fs.unlink(TMP_FILE);
    } catch {
      // No tmp file to clean — expected
    }
  }

  const counts = {
    tasks: (data.tasks || []).length,
    projects: (data.projects || []).length,
    docs: (data.docs || []).length,
    bugs: (data.bugs || []).length,
    memories: (data.conversationMemories || []).length + (data.longTermMemories || []).length,
    events: (data.scheduledEvents || []).length,
    tools: (data.tools || []).length,
  };
  console.log(`[MC] Store loaded from ${recoverySource}:`, counts);

  cache = data;
  return data;
}

export async function saveData(data: AppData): Promise<void> {
  // Serialize writes — .catch() prevents a single failed write from
  // permanently breaking the queue (rejected promise would cascade).
  writePromise = writePromise.catch(() => {}).then(async () => {
    const json = JSON.stringify(data, null, 2);

    // 1. Durable write to tmp file (write + fsync)
    await durableWrite(TMP_FILE, json);

    // 2. Atomic backup: rename current primary → backup (preserves last-known-good)
    try {
      await fs.rename(DATA_FILE, BACKUP_FILE);
    } catch {
      // First write or missing primary — no backup to make
    }

    // 3. Atomic promote: rename tmp → primary
    await fs.rename(TMP_FILE, DATA_FILE);

    // 4. fsync directory to ensure both renames are durable
    await fsyncDir(DATA_DIR);

    // 5. Cache updated only after confirmed durable write
    cache = data;

    // 6. Ensure sentinel exists (first successful write marks initialization)
    await writeSentinel();
  });

  await writePromise;
}

export function clearCache(): void {
  cache = null;
  recoverySource = "store";
  recoveryWarning = null;
}

export function generateId(): string {
  return crypto.randomUUID();
}
