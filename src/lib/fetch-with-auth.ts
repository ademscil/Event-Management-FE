"use client";

import { clearSession } from "@/lib/auth";

/**
 * Wrapper fetch yang auto-redirect ke /admin/login saat menerima 401.
 * Gunakan ini sebagai pengganti fetch() di semua lib yang membutuhkan auth.
 */
export async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status === 401) {
    clearSession();
    if (typeof window !== "undefined") {
      window.location.href = "/admin/login";
    }
  }
  return response;
}
