import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const AUTH_URL: string = import.meta.env.VITE_AUTH_URL || (import.meta.env.PROD ? window.location.origin : "http://localhost:4000");

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  fetchOptions: { credentials: "include" },
  plugins: [jwtClient()],
});

// The chat service wants a short-lived JWT, not the session cookie. Cache it until ~1 minute before it expires.
let cached: { token: string; exp: number } | null = null;

export async function getToken(): Promise<string | null> {
  if (cached && cached.exp - Date.now() > 60_000) return cached.token;
  const { data } = await authClient.token();
  if (!data?.token) {
    cached = null;
    return null;
  }
  const payload = JSON.parse(atob(data.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  cached = { token: data.token, exp: payload.exp * 1000 };
  return data.token;
}

export function clearToken() {
  cached = null;
}
