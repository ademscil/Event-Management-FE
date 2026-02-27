"use client";

import { getAccessToken } from "@/lib/auth";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

export type MappedApplicationOption = {
  ApplicationId: string;
  ApplicationCode: string;
  ApplicationName: string;
  Description?: string | null;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  return fallback;
}

async function fetchMappedApplications(
  path: string,
): Promise<{ success: boolean; applications: MappedApplicationOption[]; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, applications: [], message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; applications?: MappedApplicationOption[]; message?: string; error?: string }
      | null;

    if (!response.ok || payload?.success !== true) {
      return {
        success: false,
        applications: [],
        message: getErrorMessage(payload, "Gagal memuat aplikasi dari mapping"),
      };
    }

    return {
      success: true,
      applications: Array.isArray(payload.applications) ? payload.applications : [],
    };
  } catch {
    return { success: false, applications: [], message: "Gagal terhubung ke server" };
  }
}

export async function fetchMappedApplicationsByDepartment(
  departmentId: string,
): Promise<{ success: boolean; applications: MappedApplicationOption[]; message?: string }> {
  return fetchMappedApplications(`/mappings/application-department/department/${departmentId}`);
}

export async function fetchMappedApplicationsByFunction(
  functionId: string,
): Promise<{ success: boolean; applications: MappedApplicationOption[]; message?: string }> {
  return fetchMappedApplications(`/mappings/function-application/function/${functionId}`);
}
