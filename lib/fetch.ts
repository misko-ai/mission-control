interface ApiErrorBody {
  error?: string;
  fields?: { field: string; message: string }[];
}

type ApiResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit,
): Promise<ApiResult<T>> {
  const res = await fetch(url, options);
  if (res.ok) {
    const data = await res.json().catch(() => ({}) as T);
    return { ok: true, data };
  }
  const body: ApiErrorBody = await res.json().catch(() => ({}));
  const msg =
    body.fields?.map((f) => f.message).join(", ") ||
    body.error ||
    "Request failed";
  return { ok: false, error: msg };
}
