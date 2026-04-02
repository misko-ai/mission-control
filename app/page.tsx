import Link from "next/link";
import { getData } from "@/lib/store";

export const dynamic = "force-dynamic";
import type { Task, BugReport, Project, Agent, ActivityEntry, TaskActivityEntry, ScheduledEvent, EventType } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";
import {
  TaskboardIcon,
  BugsIcon,
  ProjectsIcon,
  TeamIcon,
  ActivityIcon,
  CalendarIcon,
} from "@/components/icons";

export default async function Dashboard() {
  const data = await getData();

  // --- Task counts by column ---
  const tasksByColumn = {
    backlog: data.tasks.filter((t: Task) => t.column === "backlog").length,
    "in-progress": data.tasks.filter((t: Task) => t.column === "in-progress").length,
    blocked: data.tasks.filter((t: Task) => t.column === "blocked").length,
    review: data.tasks.filter((t: Task) => t.column === "review").length,
    done: data.tasks.filter((t: Task) => t.column === "done").length,
  };

  // --- Bug counts by severity (open + in-progress only) ---
  const openBugs = data.bugs.filter((b: BugReport) => b.status !== "resolved");
  const bugsBySeverity = {
    critical: openBugs.filter((b: BugReport) => b.severity === "critical").length,
    high: openBugs.filter((b: BugReport) => b.severity === "high").length,
    medium: openBugs.filter((b: BugReport) => b.severity === "medium").length,
    low: openBugs.filter((b: BugReport) => b.severity === "low").length,
  };

  // --- Active projects with progress ---
  const activeProjects = data.projects.filter((p: Project) => p.status === "active" || p.status === "idea" || p.status === "planned");
  const projectsWithProgress = activeProjects.map((project: Project) => {
    const linkedTasks = project.linkedTaskIds
      .map((id: string) => data.tasks.find((t: Task) => t.id === id))
      .filter(Boolean) as Task[];
    const totalLinked = linkedTasks.length;
    const doneCount = linkedTasks.filter((t: Task) => t.column === "done").length;
    const percent = totalLinked > 0 ? Math.round((doneCount / totalLinked) * 100) : 0;
    return { ...project, totalLinked, doneCount, percent };
  });

  // --- Agent status counts ---
  const agents = data.team.agents;
  const agentsByStatus = {
    running: agents.filter((a: Agent) => a.status === "running"),
    idle: agents.filter((a: Agent) => a.status === "idle"),
    offline: agents.filter((a: Agent) => a.status === "offline"),
  };

  // --- Combined recent activity (tool + task activities) ---
  type UnifiedActivity = {
    id: string;
    type: "tool" | "task";
    action: string;
    details: string;
    timestamp: string;
  };

  const toolActivities: UnifiedActivity[] = data.activities.map((a: ActivityEntry) => ({
    id: a.id,
    type: "tool" as const,
    action: a.action,
    details: a.details,
    timestamp: a.timestamp,
  }));

  const taskActivities: UnifiedActivity[] = data.taskActivities.map((a: TaskActivityEntry) => ({
    id: a.id,
    type: "task" as const,
    action: a.action,
    details: a.details,
    timestamp: a.timestamp,
  }));

  const allActivities = [...toolActivities, ...taskActivities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  const hasActivity = allActivities.length > 0;

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Dashboard</h2>
        <p className="text-text-secondary text-sm mt-1">
          Welcome to Mission Control — your AI agent command center
        </p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <QuickStatCard
          label="Total Tasks"
          value={data.tasks.length}
          icon={<TaskboardIcon />}
          accent="text-accent"
          href="/taskboard"
        />
        <QuickStatCard
          label="Open Bugs"
          value={openBugs.length}
          icon={<BugsIcon />}
          accent={openBugs.length > 0 ? "text-danger" : "text-success"}
          href="/bugs"
        />
        <QuickStatCard
          label="Active Projects"
          value={activeProjects.length}
          icon={<ProjectsIcon />}
          accent="text-accent"
          href="/projects"
        />
        <QuickStatCard
          label="Active Agents"
          value={agentsByStatus.running.length}
          icon={<TeamIcon />}
          accent={agentsByStatus.running.length > 0 ? "text-success" : "text-text-muted"}
          href="/team"
        />
      </div>

      {/* Task Overview + Active Bugs */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Task Overview */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text">Task Overview</h3>
            <Link href="/taskboard" className="text-xs text-accent hover:text-accent-hover transition-colors">
              View board →
            </Link>
          </div>
          <div className="space-y-3">
            <ColumnBar label="Backlog" count={tasksByColumn.backlog} color="bg-text-muted" total={data.tasks.length} />
            <ColumnBar label="In Progress" count={tasksByColumn["in-progress"]} color="bg-accent" total={data.tasks.length} />
            <ColumnBar label="Blocked" count={tasksByColumn.blocked} color="bg-danger" total={data.tasks.length} />
            <ColumnBar label="Review" count={tasksByColumn.review} color="bg-warning" total={data.tasks.length} />
            <ColumnBar label="Done" count={tasksByColumn.done} color="bg-success" total={data.tasks.length} />
          </div>
        </div>

        {/* Active Bugs */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text">Active Bugs</h3>
            <Link href="/bugs" className="text-xs text-accent hover:text-accent-hover transition-colors">
              View all →
            </Link>
          </div>
          {openBugs.length > 0 ? (
            <div className="space-y-3">
              <SeverityRow label="Critical" count={bugsBySeverity.critical} colorClass="text-danger" dotClass="bg-danger" />
              <SeverityRow label="High" count={bugsBySeverity.high} colorClass="text-warning" dotClass="bg-warning" />
              <SeverityRow label="Medium" count={bugsBySeverity.medium} colorClass="text-accent" dotClass="bg-accent" />
              <SeverityRow label="Low" count={bugsBySeverity.low} colorClass="text-text-muted" dotClass="bg-text-muted" />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-text-secondary text-sm">No open bugs</p>
              <p className="text-text-muted text-xs mt-1">All clear!</p>
            </div>
          )}
        </div>
      </div>

      {/* Project Progress + Agent Status */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Project Progress */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text">Project Progress</h3>
            <Link href="/projects" className="text-xs text-accent hover:text-accent-hover transition-colors">
              View all →
            </Link>
          </div>
          {projectsWithProgress.length > 0 ? (
            <div className="space-y-4">
              {projectsWithProgress.slice(0, 5).map((project) => (
                <div key={project.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 mr-3">
                      <span className="text-sm text-text truncate">{project.name}</span>
                      {project.type && project.type !== "other" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-muted shrink-0">{project.type}</span>
                      )}
                      {project.priority && project.priority !== "medium" && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          project.priority === "critical" ? "bg-danger/15 text-danger" :
                          project.priority === "high" ? "bg-warning/15 text-warning" :
                          "bg-text-muted/15 text-text-muted"
                        }`}>{project.priority}</span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted shrink-0">
                      {project.doneCount}/{project.totalLinked} tasks ({project.percent}%)
                    </span>
                  </div>
                  {project.goal && (
                    <p className="text-xs text-text-secondary mb-1.5 truncate">{project.goal}</p>
                  )}
                  <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        project.percent === 100 ? "bg-success" : "bg-accent"
                      }`}
                      style={{ width: `${project.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-text-secondary text-sm">No active projects</p>
              <p className="text-text-muted text-xs mt-1">Create a project to track progress</p>
            </div>
          )}
        </div>

        {/* Agent Status */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text">Agent Status</h3>
            <Link href="/team" className="text-xs text-accent hover:text-accent-hover transition-colors">
              Manage →
            </Link>
          </div>
          {agents.length > 0 ? (
            <div className="space-y-2">
              {agents.map((agent: Agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-hover"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    agent.status === "running" ? "bg-success" :
                    agent.status === "idle" ? "bg-warning" :
                    "bg-text-muted"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text truncate block">{agent.name}</span>
                    <span className="text-xs text-text-muted">{agent.role}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                    agent.status === "running" ? "bg-success/20 text-success" :
                    agent.status === "idle" ? "bg-warning/20 text-warning" :
                    "bg-surface-active text-text-muted"
                  }`}>
                    {agent.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-text-secondary text-sm">No agents configured</p>
              <Link
                href="/team"
                className="inline-flex items-center gap-1 mt-2 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                Set up your team →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Schedule — full width */}
      <UpcomingSchedule events={data.scheduledEvents} />

      {/* Recent Activity — full width */}
      <div className="bg-surface border border-border rounded-lg p-5">
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
            {allActivities.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-hover"
              >
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 font-medium ${
                  entry.type === "task" ? "bg-accent/10 text-accent" : "bg-surface-active text-text-secondary"
                }`}>
                  {entry.type === "task" ? "task" : "tool"}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                  entry.action === "created" ? "bg-success/20 text-success" :
                  entry.action === "executed" ? "bg-accent/20 text-accent" :
                  entry.action === "completed" ? "bg-success/20 text-success" :
                  entry.action === "moved" ? "bg-warning/20 text-warning" :
                  entry.action === "updated" ? "bg-warning/20 text-warning" :
                  entry.action === "approved" ? "bg-success/20 text-success" :
                  entry.action === "picked-up" ? "bg-accent/20 text-accent" :
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
            <p className="text-text-muted text-xs mt-1">Events will appear here as tasks and tools are used</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helper components ---

function QuickStatCard({ label, value, icon, accent, href }: {
  label: string; value: number; icon: React.ReactNode; accent: string; href: string;
}) {
  return (
    <Link href={href} className="bg-surface border border-border rounded-lg p-5 hover:border-accent/40 transition-colors group">
      <div className="flex items-center gap-2 text-text-secondary mb-3">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-3xl font-semibold ${accent} mb-1`}>{value}</p>
    </Link>
  );
}

function ColumnBar({ label, count, color, total }: {
  label: string; count: number; color: string; total: number;
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-secondary w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-surface-hover overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-text-muted w-6 text-right shrink-0">{count}</span>
    </div>
  );
}

function SeverityRow({ label, count, colorClass, dotClass }: {
  label: string; count: number; colorClass: string; dotClass: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-hover">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
      <span className="text-sm text-text flex-1">{label}</span>
      <span className={`text-lg font-semibold ${colorClass}`}>{count}</span>
    </div>
  );
}

const eventTypeBadgeMap: Record<string, string> = {
  automation: "bg-accent/10 text-accent",
  reminder: "bg-warning/10 text-warning",
  deadline: "bg-danger/10 text-danger",
  review: "bg-success/10 text-success",
};

const eventTypeLabelMap: Record<string, string> = {
  automation: "automation",
  reminder: "reminder",
  deadline: "deadline",
  review: "review",
};

function UpcomingSchedule({ events }: { events: ScheduledEvent[] }) {
  const activeEvents = events
    .filter((e: ScheduledEvent) => e.status === "active" || e.status === "draft")
    .sort((a: ScheduledEvent, b: ScheduledEvent) => {
      const aDate = a.dueDate || a.nextRunAt || a.createdAt;
      const bDate = b.dueDate || b.nextRunAt || b.createdAt;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    })
    .slice(0, 5);

  return (
    <div className="bg-surface border border-border rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text">Upcoming Schedule</h3>
        <Link href="/calendar" className="text-xs text-accent hover:text-accent-hover transition-colors">
          View all →
        </Link>
      </div>
      {activeEvents.length > 0 ? (
        <div className="space-y-2">
          {activeEvents.map((event: ScheduledEvent) => {
            const type = (event.eventType || "automation") as string;
            return (
              <div key={event.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-hover">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  event.status === "active" ? "bg-success" : "bg-border"
                }`} />
                <span className="text-sm text-text flex-1 truncate">{event.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 font-medium ${
                  eventTypeBadgeMap[type] || "bg-surface-active text-text-secondary"
                }`}>
                  {eventTypeLabelMap[type] || type}
                </span>
                {event.dueDate && (
                  <span className="text-xs text-text-muted shrink-0">
                    Due {formatRelativeTime(event.dueDate)}
                  </span>
                )}
                {event.schedule && !event.dueDate && (
                  <span className="text-xs text-text-muted shrink-0 max-w-[180px] truncate">{event.schedule}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm">No upcoming events</p>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 mt-2 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Schedule events →
          </Link>
        </div>
      )}
    </div>
  );
}
