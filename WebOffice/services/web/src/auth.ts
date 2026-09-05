const TOKEN_KEY = "weboffice_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  exp: number;
}

// Client-side use only (routing/display) — the server is the actual verifier
// (services/api-files/app/security.py, services/collab-server/src/auth.ts).
export function decodeToken(token: string): JwtPayload {
  const [, payload] = token.split(".");
  return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
}
