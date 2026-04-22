import type { SurveyOverviewItem } from "@/types/survey";
import styles from "../page-mockup.module.css";

export function formatLastEdited(updatedAt?: string | null, createdAt?: string | null): string {
  const sourceDate = updatedAt || createdAt;
  if (!sourceDate) return "-";
  const date = new Date(sourceDate);
  const today = new Date();
  const diffInDays = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  if (diffInDays <= 0) return "Just now";
  if (diffInDays === 1) return "Yesterday";
  return `${diffInDays} days ago`;
}

export function getStatusClass(status: string): string {
  if (status === "Active") return styles.badgeActive;
  if (status === "Draft") return styles.badgeClosed;
  if (status === "In Design") return styles.badgeWarning;
  return styles.badgeClosed;
}

export function sanitizeSurveyDescription(value: string): string {
  return value
    .replace(/\s*\[Admin Event Target:[^\]]*\]\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function matchesDateRange(survey: SurveyOverviewItem, start: string, end: string): boolean {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const surveyStart = new Date(survey.StartDate);
  const surveyEnd = new Date(survey.EndDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return true;
  return surveyStart >= startDate && surveyEnd <= endDate;
}

export function matchesStatusFilter(status: string, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "draft") return status === "Draft";
  if (filter === "design") return status === "In Design";
  if (filter === "active") return status === "Active";
  if (filter === "closed") return status === "Closed";
  return true;
}
