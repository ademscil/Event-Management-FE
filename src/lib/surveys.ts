"use client";

import { getAccessToken } from "@/lib/auth";
import type { SurveyConfiguration, SurveyDetail, SurveyOverviewItem, SurveyQuestion } from "@/types/survey";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";
const EVENTS_ENDPOINT = `${API_BASE_PATH}/events`;
const SURVEYS_ENDPOINT = `${API_BASE_PATH}/surveys`;

type QueryValue = string | number | boolean | null | undefined;
export type ScheduleFrequency = "once" | "daily" | "weekly" | "monthly";

interface ScheduleRequest {
  surveyId: string;
  scheduledDate: string;
  emailTemplate: string;
  embedCover?: boolean;
  frequency?: ScheduleFrequency;
  scheduledTime?: string;
  dayOfWeek?: number;
}

function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return "";
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const maybePayload = payload as Record<string, unknown>;
  if (typeof maybePayload.message === "string") return maybePayload.message;
  if (typeof maybePayload.error === "string") return maybePayload.error;
  return fallback;
}

async function requestJson(
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; payload: Record<string, unknown> | null }> {
  const response = await fetch(path, init);
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: response.ok, payload };
}

function toSchedulePayload(input: ScheduleRequest) {
  const frequency: ScheduleFrequency = input.frequency || "once";
  const payload: Record<string, unknown> = {
    scheduledDate: input.scheduledDate,
    emailTemplate: input.emailTemplate,
    embedCover: input.embedCover ?? false,
    frequency,
  };

  if (frequency !== "once" && input.scheduledTime) {
    payload.scheduledTime = input.scheduledTime;
  }

  if (frequency === "weekly" && typeof input.dayOfWeek === "number") {
    payload.dayOfWeek = input.dayOfWeek;
  }

  return payload;
}

export async function fetchSurveyOverview(filter?: {
  assignedAdminId?: string;
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  surveys: SurveyOverviewItem[];
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, surveys: [], message: "Sesi login tidak ditemukan" };
  }

  try {
    const query = buildQuery(filter);
    const primary = await requestJson(`${EVENTS_ENDPOINT}${query}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    let resolved = primary;
    if (!primary.ok) {
      const fallback = await requestJson(`${SURVEYS_ENDPOINT}${query}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      resolved = fallback;
    }

    if (!resolved.ok || resolved.payload?.success !== true) {
      return {
        success: false,
        surveys: [],
        message: getErrorMessage(resolved.payload, "Gagal memuat data survey"),
      };
    }

    const surveys = Array.isArray(resolved.payload.surveys)
      ? (resolved.payload.surveys as SurveyOverviewItem[])
      : [];

    return { success: true, surveys };
  } catch {
    return { success: false, surveys: [], message: "Gagal terhubung ke server" };
  }
}

export async function createEventDraft(input: {
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
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

export async function generateEventLink(
  surveyId: string,
  shortenUrl: boolean,
): Promise<{ success: boolean; surveyLink?: string; shortenedLink?: string | null; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${surveyId}/link`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shortenUrl }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string; surveyLink?: string; shortenedLink?: string | null }
      | null;

    if (!response.ok || !payload?.success) {
      return { success: false, message: getErrorMessage(payload, "Gagal generate link") };
    }

    return {
      success: true,
      surveyLink: payload.surveyLink,
      shortenedLink: payload.shortenedLink ?? null,
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function scheduleEventBlast(
  input: ScheduleRequest,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${input.surveyId}/schedule-blast`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toSchedulePayload(input)),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string }
      | null;

    if (!response.ok || !payload?.success) {
      return { success: false, message: getErrorMessage(payload, "Gagal schedule blast") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function scheduleEventReminder(
  input: ScheduleRequest,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${input.surveyId}/schedule-reminder`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toSchedulePayload(input)),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string }
      | null;

    if (!response.ok || !payload?.success) {
      return { success: false, message: getErrorMessage(payload, "Gagal schedule reminder") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function fetchSurveyById(
  surveyId: string,
): Promise<{ success: boolean; survey?: SurveyDetail; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const primary = await requestJson(`${EVENTS_ENDPOINT}/${surveyId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    let resolved = primary;
    if (!primary.ok) {
      resolved = await requestJson(`${SURVEYS_ENDPOINT}/${surveyId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
    }

    if (!resolved.ok || resolved.payload?.success !== true) {
      return {
        success: false,
        message: getErrorMessage(resolved.payload, "Gagal memuat detail event"),
      };
    }

    const survey = resolved.payload.survey as SurveyDetail | undefined;
    if (!survey) {
      return { success: false, message: "Detail event tidak ditemukan" };
    }

    return { success: true, survey };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function updateEventById(
  surveyId: string,
  input: {
    title: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    status: string;
    targetRespondents?: number;
    targetScore?: number;
  },
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
        const payload: Record<string, unknown> = {
      title: input.title,
      description: input.description || "",
      status: input.status,
    };

    if (input.startDate !== undefined) {
      payload.startDate = input.startDate;
    }
    if (input.endDate !== undefined) {
      payload.endDate = input.endDate;
    }
    if (input.targetRespondents !== undefined) {
      payload.targetRespondents = input.targetRespondents;
    }
    if (input.targetScore !== undefined) {
      payload.targetScore = input.targetScore;
    }

    const response = await fetch(`${EVENTS_ENDPOINT}/${surveyId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || body?.success !== true) {
      return { success: false, message: getErrorMessage(body, "Gagal menyimpan event") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function updateEventConfiguration(
  surveyId: string,
  input: Partial<SurveyConfiguration>,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${surveyId}/config`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || body?.success !== true) {
      return { success: false, message: getErrorMessage(body, "Gagal menyimpan konfigurasi") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export interface SurveyQuestionPayload {
  surveyId: string;
  type: string;
  promptText: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  isMandatory?: boolean;
  displayOrder?: number;
  pageNumber?: number;
  layoutOrientation?: "vertical" | "horizontal";
  options?: unknown;
  commentRequiredBelowRating?: number | null;
  createdBy: string;
}

export async function fetchSurveyQuestions(
  surveyId: string,
): Promise<{ success: boolean; questions: SurveyQuestion[]; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, questions: [], message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}/questions/survey/${surveyId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; questions?: SurveyQuestion[]; message?: string; error?: string }
      | null;

    if (!response.ok || !body?.success) {
      return { success: false, questions: [], message: getErrorMessage(body, "Gagal memuat pertanyaan") };
    }

    return { success: true, questions: Array.isArray(body.questions) ? body.questions : [] };
  } catch {
    return { success: false, questions: [], message: "Gagal terhubung ke server" };
  }
}

export async function createSurveyQuestion(
  payload: SurveyQuestionPayload,
): Promise<{ success: boolean; question?: SurveyQuestion; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}/questions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; question?: SurveyQuestion; message?: string; error?: string }
      | null;

    if (!response.ok || !body?.success || !body.question) {
      return { success: false, message: getErrorMessage(body, "Gagal menambah pertanyaan") };
    }

    return { success: true, question: body.question };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function updateSurveyQuestion(
  questionId: string,
  payload: Partial<SurveyQuestionPayload> & { updatedBy?: string },
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}/questions/${questionId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || body?.success !== true) {
      return { success: false, message: getErrorMessage(body, "Gagal mengubah pertanyaan") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function deleteSurveyQuestion(
  questionId: string,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}/questions/${questionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || body?.success !== true) {
      return { success: false, message: getErrorMessage(body, "Gagal menghapus pertanyaan") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}





