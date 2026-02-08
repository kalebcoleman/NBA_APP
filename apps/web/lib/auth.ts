/**
 * Lightweight JWT token management for MVP auth.
 * Stores token in localStorage; provides get/set/clear helpers.
 */

const TOKEN_KEY = "nba_auth_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
