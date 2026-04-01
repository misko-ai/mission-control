"use client";

import { useEffect, useCallback, useRef } from "react";

export function usePolling(
  callback: () => Promise<void> | void,
  intervalMs: number = 3000
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const poll = useCallback(async () => {
    await callbackRef.current();
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, intervalMs);
    return () => clearInterval(interval);
  }, [poll, intervalMs]);
}
