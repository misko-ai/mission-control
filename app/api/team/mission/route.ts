import { NextRequest, NextResponse } from "next/server";
import { getTeam, updateMissionStatement } from "@/lib/store";

export async function GET() {
  try {
    const team = await getTeam();
    return NextResponse.json({ missionStatement: team.missionStatement });
  } catch {
    return NextResponse.json(
      { error: "Failed to load mission statement" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { missionStatement } = body;

    if (typeof missionStatement !== "string") {
      return NextResponse.json(
        { error: "Mission statement is required" },
        { status: 400 }
      );
    }

    await updateMissionStatement(missionStatement);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update mission statement" },
      { status: 500 }
    );
  }
}
