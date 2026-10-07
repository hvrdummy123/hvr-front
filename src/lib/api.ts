import { getToken } from "./auth";

export const CHAT_URL: string = import.meta.env.VITE_CHAT_URL ?? "http://localhost:4001";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("not_signed_in");
  const res = await fetch(`${CHAT_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `http_${res.status}`);
  }
  return res.json() as Promise<T>;
}
