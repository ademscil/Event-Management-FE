import type { SurveyOverviewItem } from "@/types/survey";

type EventStatusSource = Pick<SurveyOverviewItem, "Status" | "StartDate" | "EndDate">;

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function hasMeaningfulTime(date: Date): boolean {
  return date.getHours() !== 0 || date.getMinutes() !== 0;
}

export function resolveEventStatus(event: EventStatusSource, now: Date = new Date()): string {
  const rawStatus = String(event.Status || "").trim();
  const normalized = rawStatus.toLowerCase();
  const endDate = parseDate(event.EndDate);

  if (normalized === "archived") return "Archived";
  if (normalized === "closed") return "Closed";
  if (normalized === "draft") return "Draft";
  if (normalized === "in design") return "In Design";

  if (normalized === "active") {
    if (endDate && endDate.getTime() <= now.getTime()) {
      return "Closed";
    }
    return "Active";
  }

  if (endDate && endDate.getTime() <= now.getTime()) {
    return "Closed";
  }

  return rawStatus || "-";
}

export function canPublishEvent(endDateValue?: string | null, now: Date = new Date()): boolean {
  const endDate = parseDate(endDateValue);
  if (!endDate) return true;
  return endDate.getTime() > now.getTime();
}

export function formatEventPeriod(startDateValue?: string | null, endDateValue?: string | null): string {
  const startDate = parseDate(startDateValue);
  const endDate = parseDate(endDateValue);

  if (!startDate || !endDate) return "-";

  const withTime = hasMeaningfulTime(startDate) || hasMeaningfulTime(endDate);
  const format = new Intl.DateTimeFormat("id-ID", withTime
    ? {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    : {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  return `${format.format(startDate)} - ${format.format(endDate)}`;
}
