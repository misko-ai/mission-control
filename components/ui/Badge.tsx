"use client";

const variants = {
  accent: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  muted: "bg-surface-hover text-text-muted",
} as const;

export function Badge({
  children,
  variant = "muted",
  className = "",
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Priority-specific badge
const priorityConfig = {
  low: { label: "Low", variant: "muted" as const },
  medium: { label: "Medium", variant: "accent" as const },
  high: { label: "High", variant: "warning" as const },
  urgent: { label: "Urgent", variant: "danger" as const },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
