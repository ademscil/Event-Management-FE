"use client";

import type { AuthUser, LoginResult } from "@/types/auth";

const TOKEN_KEY = "csi_token";
const REFRESH_TOKEN_KEY = "csi_refresh_token";
const USER_KEY = "csi_user";
const SESSION_MARKER_KEY = "csi_session_present";
const COOKIE_SESSION_PLACEHOLDER = "__cookie_session__";
const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function getStorage(): Storage | null {
  if (!hasStorage()) return null;
  return window.sessionStorage;
}

function clearLegacyLocalStorage(): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function buildAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = hasStorage() && typeof window.localStorage !== "undefined"
    ? window.localStorage.getItem(TOKEN_KEY)
    : null;

  if (token) {
    return {
      ...extraHeaders,
      Authorization: `Bearer ${token}`,
    };
  }

  return extraHeaders;
}

function parseJsonSafely<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const maybePayload = payload as Record<string, unknown>;

  if (typeof maybePayload.message === "string") return maybePayload.message;
  if (typeof maybePayload.error === "string") return maybePayload.error;

  const details = maybePayload.details;
  if (Array.isArray(details) && details.length > 0) {
    const messages = details
      .map((item) =>
        typeof item === "object" && item && "msg" in item
          ? String((item as { msg: string }).msg)
          : ""
      )
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(", ");
    }
  }

  return fallback;
}

export async function login(
  username: string,
  password: string
): Promise<LoginResult> {
  try {
    const response = await fetch(`${API_BASE_PATH}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        message: getErrorMessage(payload, "Login gagal"),
      };
    }

    if (hasStorage()) {
      const storage = getStorage();
      storage?.setItem(USER_KEY, JSON.stringify(payload.user));
      storage?.setItem(SESSION_MARKER_KEY, "1");
      clearLegacyLocalStorage();
    }

    return { success: true, user: payload.user as AuthUser };
  } catch {
    return {
      success: false,
      message: "Gagal terhubung ke server",
    };
  }
}

export async function requestPasswordReset(
  method: "email" | "phone",
  identifier: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_PATH}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ method, identifier }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      return {
        success: false,
        message: getErrorMessage(payload, "Gagal memproses forgot password"),
      };
    }

    return {
      success: true,
      message: typeof payload?.message === "string" ? payload.message : "Permintaan reset password berhasil diproses",
    };
  } catch {
    return {
      success: false,
      message: "Gagal terhubung ke server",
    };
  }
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_PATH}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, password }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      return {
        success: false,
        message: getErrorMessage(payload, "Gagal mereset password"),
      };
    }

    return {
      success: true,
      message: typeof payload?.message === "string" ? payload.message : "Password berhasil direset",
    };
  } catch {
    return {
      success: false,
      message: "Gagal terhubung ke server",
    };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_PATH}/auth/logout`, {
      method: "POST",
      headers: buildAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
    });
  } finally {
    clearSession();
  }
}

export function clearSession(): void {
  const storage = getStorage();
  storage?.removeItem(USER_KEY);
  storage?.removeItem(SESSION_MARKER_KEY);
  clearLegacyLocalStorage();
}

export function getAccessToken(): string | null {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    const legacyToken = localStorage.getItem(TOKEN_KEY);
    if (legacyToken) return legacyToken;
  }

  const storage = getStorage();
  if (!storage) return null;

  const hasSession = storage.getItem(SESSION_MARKER_KEY) === "1" || Boolean(storage.getItem(USER_KEY));
  return hasSession ? COOKIE_SESSION_PLACEHOLDER : null;
}

export function getCurrentUser(): AuthUser | null {
  const storage = getStorage();
  if (storage) {
    const sessionUser = parseJsonSafely<AuthUser>(storage.getItem(USER_KEY));
    if (sessionUser) return sessionUser;
  }

  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    const legacyUser = parseJsonSafely<AuthUser>(localStorage.getItem(USER_KEY));
    if (legacyUser && storage) {
      storage.setItem(USER_KEY, JSON.stringify(legacyUser));
      storage.setItem(SESSION_MARKER_KEY, "1");
      clearLegacyLocalStorage();
    }
    return legacyUser;
  }

  return null;
}

export function isAuthenticated(): boolean {
  return Boolean(getCurrentUser()) || Boolean(getAccessToken());
}

export async function validateSession(): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${API_BASE_PATH}/auth/validate`, {
      method: "GET",
      headers: buildAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!payload?.valid || !payload?.user) {
      clearSession();
      return null;
    }

    const storage = getStorage();
    storage?.setItem(USER_KEY, JSON.stringify(payload.user));
    storage?.setItem(SESSION_MARKER_KEY, "1");
    clearLegacyLocalStorage();
    return payload.user as AuthUser;
  } catch {
    clearSession();
    return null;
  }
}
