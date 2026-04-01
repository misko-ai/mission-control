export function logError(context: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[MC][${timestamp}][${context}] ${message}`);
  if (stack) {
    console.error(stack);
  }
}
