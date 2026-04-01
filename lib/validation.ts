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
export const VALID_SCHEDULE_STATUS = ["active", "paused", "completed", "failed"] as const;
export const VALID_DOC_CATEGORY = ["planning", "newsletter", "technical", "research", "draft", "other"] as const;
export const VALID_DOC_FORMAT = ["markdown", "plain text", "structured"] as const;
export const VALID_MEMORY_CATEGORY = ["preference", "decision", "fact", "context", "other"] as const;
export const VALID_PROJECT_STATUS = ["active", "completed", "archived"] as const;
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
