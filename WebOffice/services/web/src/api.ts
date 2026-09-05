import { clearToken, getToken } from "./auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:48735";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export function signup(email: string, password: string, displayName: string) {
  return request<TokenResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
}

export function login(email: string, password: string) {
  return request<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export interface CurrentUserOut {
  id: string;
  email: string;
  display_name: string;
}

export function getMe() {
  return request<CurrentUserOut>("/auth/me");
}

export interface DocumentOut {
  id: string;
  folder_id: string | null;
  name: string;
  owner_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export function listDocuments() {
  return request<DocumentOut[]>("/documents");
}

export function createDocument(name: string) {
  return request<DocumentOut>("/documents", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function getDocument(id: string) {
  return request<DocumentOut>(`/documents/${id}`);
}

export function shareDocument(id: string, email: string, role: string) {
  return request<PermissionOut>(`/documents/${id}/share`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export interface PermissionOut {
  id: string;
  subject_type: string;
  subject_id: string;
  subject_email: string | null;
  subject_display_name: string | null;
  role: string;
  created_at: string;
}

export function listPermissions(id: string) {
  return request<PermissionOut[]>(`/documents/${id}/permissions`);
}
