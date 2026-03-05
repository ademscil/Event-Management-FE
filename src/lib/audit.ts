"use client";

import { getAccessToken } from "@/lib/auth";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

export type AuditLogItem = {
  LogId: string;
  Timestamp: string;
  UserId: string | null;
  Username: string;
  Action: string;
  EntityType: string | null;
  EntityId: string | null;
  OldValues: unknown;
  NewValues: unknown;
  IPAddress: string | null;
  UserAgent: string | null;
};

export type FetchAuditLogsInput = {
  page?: number;
  pageSize?: number;
  username?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const maybePayload = payload as Record<string, unknown>;
  if (typeof maybePayload.message === "string") return maybePayload.message;
  if (typeof maybePayload.error === "string") return maybePayload.error;
  return fallback;
}

function buildQuery(input: FetchAuditLogsInput): string {
  const query = new URLSearchParams();
  if (input.page) query.set("page", String(input.page));
  if (input.pageSize) query.set("pageSize", String(input.pageSize));
  if (input.username) query.set("username", input.username);
  if (input.action && input.action !== "all") query.set("action", input.action);
  if (input.entityType && input.entityType !== "all") query.set("entityType", input.entityType);
  if (input.startDate) query.set("startDate", input.startDate);
  if (input.endDate) query.set("endDate", input.endDate);
  const text = query.toString();
  return text ? `?${text}` : "";
}

export async function fetchAuditLogs(
  input: FetchAuditLogsInput = {},
): Promise<{
  success: boolean;
  logs: AuditLogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) {
    return {
      success: false,
      logs: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      message: "Sesi login tidak ditemukan",
    };
  }

  try {
    const query = buildQuery(input);
    const response = await fetch(`${API_BASE_PATH}/audit${query}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          success?: boolean;
          logs?: AuditLogItem[];
          page?: number;
          pageSize?: number;
          total?: number;
          totalPages?: number;
          message?: string;
          error?: string;
        }
      | null;

    if (!response.ok || payload?.success !== true) {
      return {
        success: false,
        logs: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
        message: getErrorMessage(payload, "Gagal memuat audit trail"),
      };
    }

    return {
      success: true,
      logs: Array.isArray(payload.logs) ? payload.logs : [],
      page: Number(payload.page || 1),
      pageSize: Number(payload.pageSize || input.pageSize || 20),
      total: Number(payload.total || 0),
      totalPages: Number(payload.totalPages || 1),
    };
  } catch {
    return {
      success: false,
      logs: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      message: "Gagal terhubung ke server",
    };
  }
}
