"use client";

import { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-12 text-center">
      {icon && <div className="flex justify-center mb-3 text-text-muted">{icon}</div>}
      <p className="text-text-secondary text-sm">{title}</p>
      {description && (
        <p className="text-xs text-text-muted mt-1">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
