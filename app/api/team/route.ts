import { NextResponse } from "next/server";
import { getAgents, getTeam } from "@/lib/store";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const [agents, team] = await Promise.all([getAgents(), getTeam()]);
    return NextResponse.json({
      agents,
      missionStatement: team.missionStatement,
    });
  } catch (err) {
    logError("GET /api/team", err);
    return NextResponse.json({ error: "Failed to load team" }, { status: 500 });
  }
}
