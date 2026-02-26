"use client";

import { getAccessToken } from "@/lib/auth";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";
const EVENTS_ENDPOINT = `${API_BASE_PATH}/events`;

interface ScheduledOperation {
  ScheduleId: number;
  Type: string;
  ScheduledDate: string;
  Status: string;
  Frequency: string;
  ScheduledTime?: string;
  DayOfWeek?: number;
}

export async function generateQRCode(surveyId: string): Promise<{ success: boolean; qrCodeUrl?: string; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${surveyId}/qr-code`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      return { success: false, message: payload?.message || "Gagal generate QR code" };
    }

    return { success: true, qrCodeUrl: payload.qrCodeUrl };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function getScheduledOperations(surveyId: string): Promise<{ success: boolean; operations?: ScheduledOperation[]; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${surveyId}/scheduled-operations`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      return { success: false, message: payload?.message || "Gagal memuat scheduled operations" };
    }

    return { success: true, operations: payload.operations || [] };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function cancelScheduledOperation(surveyId: string, scheduleId: number): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${surveyId}/scheduled-operations/${scheduleId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      return { success: false, message: payload?.message || "Gagal cancel operation" };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
