import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    endpoints: [
      { path: "/api/tasks/lifecycle/claim", method: "POST", description: "Claim a task for an agent" },
      { path: "/api/tasks/lifecycle/finalize", method: "POST", description: "Finalize a task run with outcome" },
      { path: "/api/tasks/lifecycle/heartbeat", method: "POST", description: "Send heartbeat for active run" },
      { path: "/api/tasks/lifecycle/reconcile", method: "POST", description: "Reconcile stale task runs" },
    ],
  });
}
