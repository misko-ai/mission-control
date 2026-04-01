"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  TaskboardIcon,
  CalendarIcon,
  ProjectsIcon,
  MemoriesIcon,
  DocsIcon,
  TeamIcon,
  OfficeIcon,
  ToolsIcon,
  ActivityIcon,
  BugsIcon,
  SettingsIcon,
} from "./icons";

const navItems = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/taskboard", label: "Taskboard", icon: TaskboardIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/projects", label: "Projects", icon: ProjectsIcon },
  { href: "/memories", label: "Memories", icon: MemoriesIcon },
  { href: "/docs", label: "Docs", icon: DocsIcon },
  { href: "/team", label: "Team", icon: TeamIcon },
  { href: "/office", label: "Office", icon: OfficeIcon },
  { href: "/tools", label: "Tools", icon: ToolsIcon },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
  { href: "/bugs", label: "Bugs", icon: BugsIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 h-screen bg-surface border-r border-border flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-sm font-semibold tracking-tight text-text">
          Mission Control
        </h1>
        <p className="text-xs text-text-secondary mt-0.5">Misko & Marko</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:text-text hover:bg-surface-hover"
              }`}
            >
              <item.icon />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-xs text-text-secondary">System Online</span>
        </div>
      </div>
    </aside>
  );
}
