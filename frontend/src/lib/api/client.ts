const BASE = "/api";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = (await res
      .json()
      .catch(() => ({ message: res.statusText }))) as { message?: string };
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}
