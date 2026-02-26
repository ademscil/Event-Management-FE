"use client";

import { getAccessToken } from "@/lib/auth";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

export type BusinessUnitMaster = {
  BusinessUnitId: string;
  Code: string;
  Name: string;
  IsActive: boolean;
};

export type DivisionMaster = {
  DivisionId: string;
  BusinessUnitId: string;
  Code: string;
  Name: string;
  IsActive: boolean;
};

export type DepartmentMaster = {
  DepartmentId: string;
  DivisionId: string;
  Code: string;
  Name: string;
  IsActive: boolean;
};

export type FunctionMaster = {
  FunctionId: string;
  Code: string;
  Name: string;
  IsActive: boolean;
};

export type ApplicationMaster = {
  ApplicationId: string;
  Code: string;
  Name: string;
  Description?: string | null;
  IsActive: boolean;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  if (Array.isArray(data.details) && data.details.length > 0) {
    const first = data.details[0] as Record<string, unknown>;
    if (first && typeof first.msg === "string") return first.msg;
  }
  return fallback;
}

async function authFetch<T>(
  endpoint: string,
  init: RequestInit,
  fallbackMessage: string,
  map: (payload: unknown) => T
): Promise<ApiResult<T>> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, fallbackMessage) };
    }

    return { success: true, data: map(payload) };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function fetchBusinessUnitsMaster(): Promise<ApiResult<BusinessUnitMaster[]>> {
  return authFetch(
    "/business-units?includeInactive=true",
    { method: "GET" },
    "Gagal memuat business unit",
    (payload) => ((payload as { businessUnits?: BusinessUnitMaster[] } | null)?.businessUnits || [])
  );
}

export async function createBusinessUnitMaster(input: { code: string; name: string }): Promise<ApiResult<BusinessUnitMaster>> {
  return authFetch(
    "/business-units",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah business unit",
    (payload) => (payload as { businessUnit: BusinessUnitMaster }).businessUnit
  );
}

export async function updateBusinessUnitMaster(id: string, input: Partial<{ code: string; name: string; isActive: boolean }>): Promise<ApiResult<BusinessUnitMaster>> {
  return authFetch(
    `/business-units/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui business unit",
    (payload) => (payload as { businessUnit: BusinessUnitMaster }).businessUnit
  );
}

export async function fetchDivisionsMaster(): Promise<ApiResult<DivisionMaster[]>> {
  return authFetch(
    "/divisions?includeInactive=true",
    { method: "GET" },
    "Gagal memuat divisi",
    (payload) => ((payload as { divisions?: DivisionMaster[] } | null)?.divisions || [])
  );
}

export async function createDivisionMaster(input: { businessUnitId: string; code: string; name: string }): Promise<ApiResult<DivisionMaster>> {
  return authFetch(
    "/divisions",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah divisi",
    (payload) => (payload as { division: DivisionMaster }).division
  );
}

export async function updateDivisionMaster(id: string, input: Partial<{ businessUnitId: string; code: string; name: string; isActive: boolean }>): Promise<ApiResult<DivisionMaster>> {
  return authFetch(
    `/divisions/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui divisi",
    (payload) => (payload as { division: DivisionMaster }).division
  );
}

export async function fetchDepartmentsMaster(): Promise<ApiResult<DepartmentMaster[]>> {
  return authFetch(
    "/departments?includeInactive=true",
    { method: "GET" },
    "Gagal memuat department",
    (payload) => ((payload as { departments?: DepartmentMaster[] } | null)?.departments || [])
  );
}

export async function createDepartmentMaster(input: { divisionId: string; code: string; name: string }): Promise<ApiResult<DepartmentMaster>> {
  return authFetch(
    "/departments",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah department",
    (payload) => (payload as { department: DepartmentMaster }).department
  );
}

export async function updateDepartmentMaster(id: string, input: Partial<{ divisionId: string; code: string; name: string; isActive: boolean }>): Promise<ApiResult<DepartmentMaster>> {
  return authFetch(
    `/departments/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui department",
    (payload) => (payload as { department: DepartmentMaster }).department
  );
}

export async function fetchFunctionsMaster(): Promise<ApiResult<FunctionMaster[]>> {
  return authFetch(
    "/functions?includeInactive=true",
    { method: "GET" },
    "Gagal memuat function",
    (payload) => ((payload as { functions?: FunctionMaster[] } | null)?.functions || [])
  );
}

export async function createFunctionMaster(input: { code: string; name: string }): Promise<ApiResult<FunctionMaster>> {
  return authFetch(
    "/functions",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah function",
    (payload) => (payload as { function: FunctionMaster }).function
  );
}

export async function updateFunctionMaster(id: string, input: Partial<{ code: string; name: string; isActive: boolean }>): Promise<ApiResult<FunctionMaster>> {
  return authFetch(
    `/functions/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui function",
    (payload) => (payload as { function: FunctionMaster }).function
  );
}

export async function fetchApplicationsMaster(): Promise<ApiResult<ApplicationMaster[]>> {
  return authFetch(
    "/applications?includeInactive=true",
    { method: "GET" },
    "Gagal memuat aplikasi",
    (payload) => ((payload as { applications?: ApplicationMaster[] } | null)?.applications || [])
  );
}

export async function createApplicationMaster(input: { code: string; name: string; description?: string }): Promise<ApiResult<ApplicationMaster>> {
  return authFetch(
    "/applications",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah aplikasi",
    (payload) => (payload as { application: ApplicationMaster }).application
  );
}

export async function updateApplicationMaster(id: string, input: Partial<{ code: string; name: string; description: string; isActive: boolean }>): Promise<ApiResult<ApplicationMaster>> {
  return authFetch(
    `/applications/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui aplikasi",
    (payload) => (payload as { application: ApplicationMaster }).application
  );
}
