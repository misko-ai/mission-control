import Link from "next/link";
import { getData } from "@/lib/store";

export default async function Dashboard() {
  const data = await getData();
  const recentActivity = data.activities.slice(0, 6);
  const recentTools = data.tools.slice(0, 5);
  const totalExecutions = data.tools.reduce((acc, t) => acc + t.usageCount, 0);

  const hasTools = data.tools.length > 0;
  const hasActivity = data.activities.length > 0;

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Dashboard</h2>
        <p className="text-text-secondary text-sm mt-1">
          Welcome to Mission Control — your AI agent command center
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Tools"
          value={data.tools.length.toString()}
          sublabel={hasTools ? "registered" : "get started"}
          icon={<ToolsIcon />}
          accent="text-accent"
        />
        <StatCard
          label="Total Executions"
          value={totalExecutions.toString()}
          sublabel={totalExecutions === 0 ? "no runs yet" : "times run"}
          icon={<ActivityIcon />}
          accent="text-success"
        />
        <StatCard
          label="Activity Events"
          value={data.activities.length.toString()}
          sublabel={hasActivity ? "logged" : "no events yet"}
          icon={<LogIcon />}
          accent="text-warning"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text">Quick Actions</h3>
          </div>
          <div className="space-y-2">
            <Link
              href="/tools"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm bg-surface-hover hover:bg-surface-active text-text transition-colors group"
            >
              <PlusIcon />
              <span>Create New Tool</span>
              <ArrowRightIcon className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <Link
              href="/activity"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm bg-surface-hover hover:bg-surface-active text-text transition-colors"
            >
              <ActivityIcon />
              <span>View Activity Log</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm bg-surface-hover hover:bg-surface-active text-text transition-colors"
            >
              <SettingsIcon />
              <span>Settings</span>
            </Link>
          </div>
        </div>

        {/* Recent Tools */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text">Recent Tools</h3>
            {hasTools && (
              <Link href="/tools" className="text-xs text-accent hover:text-accent-hover transition-colors">
                View all →
              </Link>
            )}
          </div>
          {hasTools ? (
            <div className="space-y-1.5">
              {recentTools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md bg-surface-hover"
                >
                  <span className="text-sm truncate flex-1 mr-3">{tool.name}</span>
                  <span className="text-xs text-text-muted shrink-0">
                    {tool.usageCount} run{tool.usageCount !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-text-secondary text-sm">No tools yet</p>
              <Link
                href="/tools"
                className="inline-flex items-center gap-1 mt-2 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                Create your first tool <ArrowRightIcon />
              </Link>
            </div>
          )}
        </div>

        {/* Recent Activity — full width */}
        <div className="bg-surface border border-border rounded-lg p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text">Recent Activity</h3>
            {hasActivity && (
              <Link href="/activity" className="text-xs text-accent hover:text-accent-hover transition-colors">
                View all →
              </Link>
            )}
          </div>
          {hasActivity ? (
            <div className="space-y-1.5">
              {recentActivity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-hover"
                >
                  <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                    entry.action === "created" ? "bg-success/20 text-success" :
                    entry.action === "executed" ? "bg-accent/20 text-accent" :
                    entry.action === "updated" ? "bg-warning/20 text-warning" :
                    "bg-danger/20 text-danger"
                  }`}>
                    {entry.action}
                  </span>
                  <span className="text-sm flex-1 truncate">{entry.details}</span>
                  <span className="text-xs text-text-muted shrink-0">
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-text-secondary text-sm">No activity yet</p>
              <p className="text-text-muted text-xs mt-1">Events will appear here as tools are used</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatCard({ label, value, sublabel, icon, accent }: {
  label: string; value: string; sublabel: string; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-center gap-2 text-text-secondary mb-3">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-3xl font-semibold ${accent} mb-1`}>{value}</p>
      <p className="text-xs text-text-muted">{sublabel}</p>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function LogIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
