const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function requestApi<T>(
  path: string,
  initData: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `tma ${initData}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
  throw new Error(payload?.detail || "Не удалось выполнить действие. Попробуйте ещё раз.");
}
