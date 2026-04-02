import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getData, getRecoverySource, getRecoveryWarning } from "@/lib/db";

const DATA_DIR = path.join(process.cwd(), "data");
const NEXT_CACHE_DIR = path.join(process.cwd(), ".next");

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const data = await getData();

  const storeFile = await fileExists(path.join(DATA_DIR, "store.json"));
  const backupFile = await fileExists(path.join(DATA_DIR, "store.json.bak"));
  const sentinelFile = await fileExists(path.join(DATA_DIR, ".initialized"));
  const nextCacheValid =
    (await fileExists(path.join(NEXT_CACHE_DIR, "routes-manifest.json"))) &&
    (await fileExists(path.join(NEXT_CACHE_DIR, "build-manifest.json")));

  const source = getRecoverySource();
  const status = source === "backup" || source === "tmp-recovery" ? "degraded" : "ok";

  return NextResponse.json({
    status,
    recoverySource: source,
    recoveryWarning: getRecoveryWarning(),
    storeFile,
    backupFile,
    sentinelFile,
    nextCacheValid,
    recordCounts: {
      tasks: data.tasks.length,
      projects: data.projects.length,
      docs: data.docs.length,
      bugs: data.bugs.length,
      conversationMemories: data.conversationMemories.length,
      longTermMemories: data.longTermMemories.length,
      scheduledEvents: data.scheduledEvents.length,
      tools: data.tools.length,
      agents: data.team.agents.length,
    },
  });
}
