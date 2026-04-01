import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { AppData } from "./types";

const DATA_FILE = path.join(process.cwd(), "data", "store.json");
const BACKUP_FILE = DATA_FILE + ".bak";
const TMP_FILE = DATA_FILE + ".tmp";

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

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function applyDefaults(data: Record<string, unknown>): AppData {
  data.tasks ??= [];
  data.taskActivities ??= [];
  data.scheduledEvents ??= [];
  data.projects ??= [];
  data.conversationMemories ??= [];
  data.longTermMemories ??= [];
  data.docs ??= [];
  data.team ??= { missionStatement: "", agents: [] };
  (data.team as Record<string, unknown>).agents ??= [];
  data.bugs ??= [];
  return data as unknown as AppData;
}

export async function getData(): Promise<AppData> {
  if (cache) return cache;

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

export function generateId(): string {
  return crypto.randomUUID();
}
