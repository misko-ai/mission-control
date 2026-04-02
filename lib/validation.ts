import { NextResponse } from "next/server";

// Valid enum values derived from lib/types.ts
export const VALID_BUG_SEVERITY = ["low", "medium", "high", "critical"] as const;
export const VALID_BUG_STATUS = ["open", "in-progress", "resolved"] as const;
export const VALID_TASK_PRIORITY = ["low", "medium", "high", "urgent"] as const;
export const VALID_TASK_COLUMN = ["backlog", "in-progress", "review", "done", "blocked"] as const;
export const VALID_TASK_ASSIGNEE = ["user", "agent"] as const;
export const VALID_AGENT_ROLE = ["orchestrator", "worker", "specialist"] as const;
export const VALID_AGENT_STATUS = ["running", "idle", "offline"] as const;
export const VALID_SCHEDULE_TYPE = ["recurring", "one-time"] as const;
export const VALID_SCHEDULE_STATUS = ["active", "paused", "completed", "failed", "draft"] as const;
export const VALID_EVENT_TYPE = ["automation", "reminder", "deadline", "review"] as const;
export const VALID_EVENT_OWNER = ["user", "agent"] as const;
export const VALID_EVENT_PRIORITY = ["low", "medium", "high"] as const;
export const VALID_EVENT_OUTCOME = ["ok", "failed", "skipped"] as const;
export const VALID_DOC_CATEGORY = ["planning", "newsletter", "technical", "research", "draft", "other"] as const;
export const VALID_DOC_FORMAT = ["markdown", "plain text", "structured"] as const;
export const VALID_MEMORY_CATEGORY = ["preference", "decision", "fact", "context", "other"] as const;
export const VALID_PROJECT_STATUS = ["idea", "planned", "active", "blocked", "completed", "archived", "canceled"] as const;
export const VALID_PROJECT_PRIORITY = ["low", "medium", "high", "critical"] as const;
export const VALID_PROJECT_TYPE = ["idea", "initiative", "maintenance", "automation", "research", "product", "other"] as const;
export const VALID_PROJECT_OWNER = ["user", "agent", "shared"] as const;
export const VALID_PLANNING_STATE = ["not-started", "in-progress", "ready"] as const;
export const VALID_EXECUTION_MODE = ["manual", "assistive", "autonomous-with-review"] as const;
export const VALID_MILESTONE_STATUS = ["pending", "in-progress", "completed"] as const;
export const VALID_SUGGESTED_TASK_STATUS = ["proposed", "accepted", "rejected"] as const;
export const VALID_THEME = ["light", "dark"] as const;
export const VALID_LOG_LEVEL = ["verbose", "normal"] as const;
export const VALID_NOTE_AUTHOR = ["user", "agent"] as const;

export interface ValidationError {
  field: string;
  message: string;
}

export function isOneOf<T extends string>(value: unknown, valid: readonly T[]): value is T {
  return typeof value === "string" && (valid as readonly string[]).includes(value);
}

export function requireString(
  value: unknown,
  fieldName: string,
  opts?: { maxLength?: number }
): string | ValidationError {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { field: fieldName, message: `${fieldName} is required` };
  }
  if (opts?.maxLength && value.length > opts.maxLength) {
    return { field: fieldName, message: `${fieldName} must be at most ${opts.maxLength} characters` };
  }
  return value;
}

export function requireEnum<T extends string>(
  value: unknown,
  fieldName: string,
  valid: readonly T[]
): T | ValidationError {
  if (!isOneOf(value, valid)) {
    return { field: fieldName, message: `${fieldName} must be one of: ${valid.join(", ")}` };
  }
  return value;
}

export function optionalEnum<T extends string>(
  value: unknown,
  fieldName: string,
  valid: readonly T[],
  fallback: T
): T | ValidationError {
  if (value === undefined || value === null) return fallback;
  return requireEnum(value, fieldName, valid);
}

export function optionalString(
  value: unknown,
  fieldName: string,
  opts?: { maxLength?: number }
): string | undefined | ValidationError {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    return { field: fieldName, message: `${fieldName} must be a string` };
  }
  if (opts?.maxLength && value.length > opts.maxLength) {
    return { field: fieldName, message: `${fieldName} must be at most ${opts.maxLength} characters` };
  }
  return value;
}

export function optionalStringArray(
  value: unknown,
  fieldName: string,
  opts?: { maxItems?: number; maxItemLength?: number }
): string[] | undefined | ValidationError {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    return { field: fieldName, message: `${fieldName} must be an array` };
  }
  if (opts?.maxItems && value.length > opts.maxItems) {
    return { field: fieldName, message: `${fieldName} must have at most ${opts.maxItems} items` };
  }
  for (const item of value) {
    if (typeof item !== "string") {
      return { field: fieldName, message: `${fieldName} must contain only strings` };
    }
    if (opts?.maxItemLength && item.length > opts.maxItemLength) {
      return { field: fieldName, message: `Each item in ${fieldName} must be at most ${opts.maxItemLength} characters` };
    }
  }
  return value;
}

export function isError(result: unknown): result is ValidationError {
  return typeof result === "object" && result !== null && "field" in result && "message" in result;
}

export function collectErrors(...results: unknown[]): ValidationError[] {
  return results.filter(isError);
}

export function validationResponse(errors: ValidationError[]): NextResponse | null {
  if (errors.length === 0) return null;
  return NextResponse.json(
    { error: "Validation failed", fields: errors },
    { status: 400 }
  );
}
