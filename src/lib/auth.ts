"use client";

import type { AuthUser, LoginResult } from "@/types/auth";

const TOKEN_KEY = "csi_token";
const REFRESH_TOKEN_KEY = "csi_refresh_token";
const USER_KEY = "csi_user";
const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

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
      body: JSON.stringify({ username, password }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        message: getErrorMessage(payload, "Login gagal"),
      };
    }

    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));

    return { success: true, user: payload.user as AuthUser };
  } catch {
    return {
      success: false,
      message: "Gagal terhubung ke server",
    };
  }
}

export async function logout(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);

  try {
    if (token) {
      await fetch(`${API_BASE_PATH}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    }
  } finally {
    clearSession();
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): AuthUser | null {
  return parseJsonSafely<AuthUser>(localStorage.getItem(USER_KEY));
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export async function validateSession(): Promise<AuthUser | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_PATH}/auth/validate`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    return payload.user as AuthUser;
  } catch {
    clearSession();
    return null;
  }
}
