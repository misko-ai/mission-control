import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { clearCache } from "@/lib/db";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const BACKUP_FILE = STORE_FILE + ".bak";
const TMP_FILE = STORE_FILE + ".tmp";
const SENTINEL_FILE = path.join(DATA_DIR, ".initialized");

type Target = "store" | "backup" | "both" | "sentinel" | "all";
type Mode = "corrupt" | "delete";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const body = await req.json();
  const target: Target = body.target ?? "store";
  const mode: Mode = body.mode ?? "corrupt";

  const targets: string[] = [];
  if (target === "store" || target === "both" || target === "all") targets.push(STORE_FILE);
  if (target === "backup" || target === "both" || target === "all") targets.push(BACKUP_FILE);
  if (target === "all") {
    targets.push(TMP_FILE);
    targets.push(SENTINEL_FILE);
  }
  if (target === "sentinel") targets.push(SENTINEL_FILE);

  const results: Record<string, string> = {};

  for (const file of targets) {
    const name = path.basename(file);
    try {
      if (mode === "corrupt") {
        await fs.writeFile(file, "CORRUPTED-NOT-VALID-JSON-{{{");
        results[name] = "corrupted";
      } else {
        await fs.unlink(file);
        results[name] = "deleted";
      }
    } catch {
      results[name] = "not-found";
    }
  }

  // Clear in-memory cache so next getData() re-reads from disk
  clearCache();

  return NextResponse.json({ done: true, mode, target, results });
}
