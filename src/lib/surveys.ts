"use client";

import { getAccessToken } from "@/lib/auth";
import type { SurveyOverviewItem, SurveysResponse } from "@/types/survey";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";
const EVENTS_ENDPOINT = `${API_BASE_PATH}/events`;
const SURVEYS_ENDPOINT = `${API_BASE_PATH}/surveys`;

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const maybePayload = payload as Record<string, unknown>;
  if (typeof maybePayload.message === "string") return maybePayload.message;
  if (typeof maybePayload.error === "string") return maybePayload.error;
  return fallback;
}

export async function fetchSurveyOverview(): Promise<{
  success: boolean;
  surveys: SurveyOverviewItem[];
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, surveys: [], message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(EVENTS_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    let payload = (await response.json().catch(() => null)) as SurveysResponse | null;
    let resolvedResponse = response;
    if (response.status === 404) {
      const fallbackResponse = await fetch(SURVEYS_ENDPOINT, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      resolvedResponse = fallbackResponse;
      payload = (await fallbackResponse.json().catch(() => null)) as SurveysResponse | null;
    }

    if (!resolvedResponse.ok || !payload?.success) {
      return {
        success: false,
        surveys: [],
        message: getErrorMessage(payload, "Gagal memuat data survey"),
      };
    }

    return { success: true, surveys: payload.surveys || [] };
  } catch {
    return { success: false, surveys: [], message: "Gagal terhubung ke server" };
  }
}

export async function createEventDraft(input: {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  assignedAdminId?: string;
  targetRespondents?: number;
  targetScore?: number;
}): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    let payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string }
      | null;
    let resolvedResponse = response;
    if (response.status === 404) {
      const fallbackResponse = await fetch(SURVEYS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      resolvedResponse = fallbackResponse;
      payload = (await fallbackResponse.json().catch(() => null)) as
        | { success?: boolean; message?: string; error?: string }
        | null;
    }

    if (!resolvedResponse.ok || !payload?.success) {
      return { success: false, message: getErrorMessage(payload, "Gagal membuat event") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
