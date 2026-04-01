"use client";

import { useState, useCallback } from "react";

interface UseApiOptions {
  onSuccess?: (data: Record<string, unknown>) => void;
  onError?: (error: string) => void;
}

export function useApi(options: UseApiOptions = {}) {
  const [loading, setLoading] = useState(false);

  const request = useCallback(
    async (url: string, init?: RequestInit) => {
      setLoading(true);
      try {
        const res = await fetch(url, init);
        const data = await res.json();
        if (!res.ok) {
          const msg = data.error || `Request failed (${res.status})`;
          options.onError?.(msg);
          return null;
        }
        options.onSuccess?.(data);
        return data;
      } catch {
        options.onError?.("Network error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const get = useCallback((url: string) => request(url), [request]);

  const post = useCallback(
    (url: string, body: unknown) =>
      request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    [request]
  );

  const put = useCallback(
    (url: string, body: unknown) =>
      request(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    [request]
  );

  const del = useCallback(
    (url: string) => request(url, { method: "DELETE" }),
    [request]
  );

  return { loading, get, post, put, del, request };
}
