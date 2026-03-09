"use client";

/* eslint-disable react-hooks/set-state-in-effect */

/* eslint-disable @next/next/no-img-element */

import { fetchSurveyById, updateEventById, updateEventConfiguration, fetchSurveyQuestions, fetchSurveyResponseStatistics, createSurveyQuestion, updateSurveyQuestion, deleteSurveyQuestion, uploadSurveyQuestionImage } from "@/lib/surveys";
import { fetchOrgHierarchy, type BusinessUnitOption, type DivisionOption, type DepartmentOption } from "@/lib/org-hierarchy";
import { fetchFunctionsMaster, type FunctionMaster } from "@/lib/master-data";
import { fetchMappedApplicationsByDepartment, fetchMappedApplicationsByFunction } from "@/lib/mappings";
import { canPublishEvent, resolveEventStatus } from "@/lib/event-status";
import type { SurveyQuestion } from "@/types/survey";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import styles from "./survey-create.module.css";
import SurveyPreviewElement from "@/components/survey/survey-preview-element";

type ElementType = "hero" | "text" | "choice" | "checkbox" | "dropdown" | "rating" | "likert" | "matrix" | "date" | "signature";

type FontPreset = "default" | "georgia" | "trebuchet" | "verdana" | "tahoma" | "courier";

type DataSourceType =
  | "manual"
  | "bu"
  | "division"
  | "department"
  | "function"
  | "app_department"
  | "app_function";

type ProfileFieldType = "bu" | "division" | "department" | "function" | null;

interface BuilderElement {
  id: string;
  type: ElementType;
  title: string;
  subtitle: string;
  required: boolean;
  options: string[];
  coverUrl: string;
  dataSource?: DataSourceType;
  optionLayout?: "vertical" | "horizontal";
  allowMultipleAnswers?: boolean;
  displayCondition?: "always" | "after_mapped_selection";
  conditionalRequiredSourceId?: string;
  conditionalRequiredThreshold?: number;
}

interface BuilderPage {
  id: number;
  title: string;
  elements: BuilderElement[];
}

interface TemplateElementInput {
  type: ElementType;
  title: string;
  subtitle?: string;
  required?: boolean;
  options?: string[];
  dataSource?: DataSourceType;
  optionLayout?: "vertical" | "horizontal";
  allowMultipleAnswers?: boolean;
  displayCondition?: "always" | "after_mapped_selection";
  conditionalRequiredSourceIndex?: number;
  conditionalRequiredThreshold?: number;
}

interface TemplatePageInput {
  title: string;
  elements: TemplateElementInput[];
}

interface BuilderTemplate {
  id: string;
  name: string;
  category: "feedback" | "employee" | "service" | "compliance" | "event";
  description: string;
  pages: TemplatePageInput[];
}

interface DraftPayload {
  surveyTitle: string;
  surveyDesc: string;
  targetRespondents: string;
  targetScore: string;
  scheduleStart: string;
  scheduleEnd: string;
  pages: BuilderPage[];
  savedAt?: string;
  style: {
    logo: string;
    backgroundColor: string;
    backgroundImage: string;
    font: FontPreset;
    heroTitle: string;
    heroSubtitle: string;
    primaryColor: string;
    secondaryColor: string;
    buttonStyle: "rounded" | "pill" | "square";
    showProgressBar: boolean;
    showPageNumbers: boolean;
    multiPage: boolean;
  };
}

function sanitizeSurveyDescription(value: string): string {
  return value
    .replace(/\s*\[Admin Event Target:[^\]]*\]\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const FONT_MAP: Record<FontPreset, string> = {
  default: "inherit",
  georgia: 'Georgia, "Times New Roman", serif',
  trebuchet: '"Trebuchet MS", "Lucida Sans Unicode", sans-serif',
  verdana: "Verdana, Geneva, sans-serif",
  tahoma: "Tahoma, Geneva, sans-serif",
  courier: '"Courier New", Courier, monospace',
};

const ELEMENTS: Array<{ type: ElementType; label: string; icon: string }> = [
  { type: "hero", label: "Hero Cover", icon: "\u{1F5BC}\uFE0F" },
  { type: "text", label: "Text Input", icon: "T" },
  { type: "choice", label: "Multiple Choice", icon: "\u25CF" },
  { type: "checkbox", label: "Checkboxes", icon: "\u2611" },
  { type: "dropdown", label: "Dropdown", icon: "\u25BE" },
  { type: "rating", label: "Rating", icon: "\u2605" },
  { type: "likert", label: "Likert Scale", icon: "\u{1F4CA}" },
  { type: "matrix", label: "Matrix", icon: "\u29DE" },
  { type: "date", label: "Date", icon: "\u{1F4C5}" },
  { type: "signature", label: "Signature", icon: "\u270D\uFE0F" },
];

const BUILDER_TEMPLATES: BuilderTemplate[] = [
  {
    id: "employee-satisfaction",
    name: "Employee Satisfaction",
    category: "employee",
    description: "Template umum kepuasan karyawan dengan metrik rating dan komentar prioritas perbaikan.",
    pages: [
      {
        title: "Welcome",
        elements: [
          { type: "hero", title: "Employee Satisfaction Survey", subtitle: "Feedback Anda membantu peningkatan layanan internal." },
          { type: "dropdown", title: "Business Unit", required: true, dataSource: "bu", options: ["Corporate"] },
          { type: "dropdown", title: "Department", required: true, dataSource: "department", options: ["IT"] },
        ],
      },
      {
        title: "Experience",
        elements: [
          { type: "choice", title: "Area yang Anda nilai", required: true, dataSource: "app_department", options: ["App A"] },
          { type: "rating", title: "Skor kepuasan keseluruhan", required: true, options: ["10"], displayCondition: "after_mapped_selection" },
          { type: "text", title: "Alasan skor Anda", required: false, displayCondition: "after_mapped_selection", conditionalRequiredSourceIndex: 1, conditionalRequiredThreshold: 7 },
        ],
      },
      {
        title: "Improvement Plan",
        elements: [
          { type: "checkbox", title: "Prioritas peningkatan", options: ["Stability", "Performance", "UI/UX", "Support"] },
          { type: "text", title: "Saran tambahan", required: false },
          { type: "signature", title: "Konfirmasi responden", required: false },
        ],
      },
    ],
  },
  {
    id: "post-event-feedback",
    name: "Post-Event Feedback",
    category: "event",
    description: "Template evaluasi event setelah kegiatan selesai, termasuk sesi, materi, dan fasilitator.",
    pages: [
      {
        title: "Opening",
        elements: [
          { type: "hero", title: "Post-Event Feedback Survey", subtitle: "Mohon evaluasi event yang baru Anda ikuti." },
          { type: "text", title: "Nama Event", required: true },
          { type: "date", title: "Tanggal Event", required: true },
        ],
      },
      {
        title: "Evaluation",
        elements: [
          { type: "likert", title: "Penilaian sesi", required: true, options: ["Materi relevan", "Pembicara jelas", "Durasi efektif"] },
          { type: "rating", title: "Skor event keseluruhan", required: true, options: ["10"] },
          { type: "text", title: "Saran perbaikan", required: false, conditionalRequiredSourceIndex: 1, conditionalRequiredThreshold: 8 },
        ],
      },
    ],
  },
  {
    id: "it-service-quality",
    name: "IT Service Quality",
    category: "service",
    description: "Template evaluasi kualitas layanan IT helpdesk dan aplikasi pendukung kerja.",
    pages: [
      {
        title: "Profile",
        elements: [
          { type: "dropdown", title: "Function", required: true, dataSource: "function", options: ["IT"] },
          { type: "choice", title: "Aplikasi yang dinilai", required: true, dataSource: "app_function", options: ["App X"] },
        ],
      },
      {
        title: "Service Score",
        elements: [
          { type: "matrix", title: "Penilaian detail layanan", required: true, options: ["Kecepatan", "Ketepatan Solusi", "Komunikasi"] },
          { type: "rating", title: "Skor layanan IT", required: true, options: ["10"], displayCondition: "after_mapped_selection" },
          { type: "text", title: "Masukan prioritas", displayCondition: "after_mapped_selection", conditionalRequiredSourceIndex: 1, conditionalRequiredThreshold: 7 },
        ],
      },
      {
        title: "Follow-up",
        elements: [
          { type: "choice", title: "Apakah perlu tindak lanjut tim IT?", required: true, options: ["Ya", "Tidak"] },
          { type: "date", title: "Target tindak lanjut", required: false },
        ],
      },
    ],
  },
  {
    id: "application-adoption",
    name: "Application Adoption",
    category: "service",
    description: "Template untuk mengukur adopsi dan kemudahan penggunaan aplikasi.",
    pages: [
      {
        title: "Selection",
        elements: [
          { type: "dropdown", title: "Business Unit", required: true, dataSource: "bu", options: ["Corporate"] },
          { type: "dropdown", title: "Division", required: true, dataSource: "division", options: ["IT"] },
          { type: "choice", title: "Aplikasi utama", required: true, dataSource: "app_department", options: ["App 1"] },
        ],
      },
      {
        title: "Adoption",
        elements: [
          { type: "checkbox", title: "Fitur yang sering digunakan", options: ["Dashboard", "Report", "Approval"], optionLayout: "vertical", displayCondition: "after_mapped_selection" },
          { type: "rating", title: "Kemudahan penggunaan", required: true, options: ["10"], displayCondition: "after_mapped_selection" },
          { type: "text", title: "Kendala penggunaan", displayCondition: "after_mapped_selection" },
        ],
      },
    ],
  },
  {
    id: "compliance-self-assessment",
    name: "Compliance Self Assessment",
    category: "compliance",
    description: "Template audit kepatuhan internal dengan matrix, bukti tanggal, dan approval signature.",
    pages: [
      {
        title: "Assessment",
        elements: [
          { type: "dropdown", title: "Department", required: true, dataSource: "department", options: ["Dept"] },
          { type: "matrix", title: "Checklist kepatuhan", required: true, options: ["Policy", "Process", "Evidence"] },
          { type: "date", title: "Tanggal pemeriksaan", required: true },
        ],
      },
      {
        title: "Risk Score",
        elements: [
          { type: "rating", title: "Skor kepatuhan", required: true, options: ["10"] },
          { type: "text", title: "Alasan skor", required: false, conditionalRequiredSourceIndex: 0, conditionalRequiredThreshold: 8 },
        ],
      },
      {
        title: "Evidence",
        elements: [
          { type: "text", title: "Ringkasan bukti", required: true },
          { type: "date", title: "Tanggal verifikasi evidence", required: true },
        ],
      },
      {
        title: "Acknowledgement",
        elements: [
          { type: "text", title: "Catatan temuan", required: false },
          { type: "signature", title: "Tanda tangan PIC", required: true },
        ],
      },
    ],
  },
  {
    id: "request-intake",
    name: "Request Intake",
    category: "feedback",
    description: "Template intake kebutuhan/permintaan user sebelum proyek atau enhancement dimulai.",
    pages: [
      {
        title: "Request Intake",
        elements: [
          { type: "text", title: "Nama Pemohon", required: true },
          { type: "dropdown", title: "Business Unit", required: true, dataSource: "bu", options: ["Corporate"] },
          { type: "dropdown", title: "Department", required: true, dataSource: "department", options: ["IT"] },
          { type: "text", title: "Ringkasan kebutuhan", required: true },
          { type: "checkbox", title: "Tipe kebutuhan", required: true, options: ["Bug Fix", "Enhancement", "New Feature"] },
          { type: "date", title: "Target implementasi", required: false },
          { type: "rating", title: "Urgensi request", required: true, options: ["10"] },
        ],
      },
    ],
  },
  {
    id: "research-survey",
    name: "Research Survey",
    category: "feedback",
    description: "Template riset preferensi user dengan kombinasi question kuantitatif dan kualitatif.",
    pages: [
      {
        title: "Research Profile",
        elements: [
          { type: "dropdown", title: "Function", required: true, dataSource: "function", options: ["IT"] },
          { type: "choice", title: "Aplikasi fokus riset", required: true, dataSource: "app_function", options: ["App Focus"] },
        ],
      },
      {
        title: "Research Answers",
        elements: [
          { type: "rating", title: "Skor pengalaman", required: true, options: ["10"], displayCondition: "after_mapped_selection" },
          { type: "text", title: "Insight utama", required: true, displayCondition: "after_mapped_selection" },
          { type: "checkbox", title: "Faktor prioritas", options: ["Performance", "UI/UX", "Stability"], displayCondition: "after_mapped_selection" },
        ],
      },
      {
        title: "Conclusion",
        elements: [
          { type: "likert", title: "Tingkat urgensi perbaikan", options: ["1 bulan", "3 bulan", "6 bulan"] },
          { type: "text", title: "Kesimpulan responden", required: false },
        ],
      },
    ],
  },
  {
    id: "full-evaluation",
    name: "Full Evaluation Pack",
    category: "employee",
    description: "Template lengkap untuk evaluasi menyeluruh (semua jenis elemen utama tersedia).",
    pages: [
      {
        title: "Welcome",
        elements: [
          { type: "hero", title: "Full Evaluation Survey", subtitle: "Template lengkap untuk kebutuhan evaluasi umum." },
          { type: "dropdown", title: "Business Unit", dataSource: "bu", required: true, options: ["Corporate"] },
          { type: "dropdown", title: "Department", dataSource: "department", required: true, options: ["IT"] },
        ],
      },
      {
        title: "Questions",
        elements: [
          { type: "choice", title: "Aplikasi yang dievaluasi", required: true, dataSource: "app_department", options: ["App 1"] },
          { type: "checkbox", title: "Aspek yang diprioritaskan", options: ["Reliability", "Support", "Feature"], displayCondition: "after_mapped_selection" },
          { type: "likert", title: "Evaluasi per dimensi", options: ["Usability", "Performance", "Support"], displayCondition: "after_mapped_selection" },
          { type: "rating", title: "Skor overall", required: true, options: ["10"], displayCondition: "after_mapped_selection" },
          { type: "text", title: "Komentar detail", displayCondition: "after_mapped_selection", conditionalRequiredSourceIndex: 3, conditionalRequiredThreshold: 8 },
        ],
      },
      {
        title: "Operational Notes",
        elements: [
          { type: "matrix", title: "Penilaian operasional", options: ["Availability", "Accuracy", "Response"] },
          { type: "date", title: "Tanggal evaluasi", required: true },
          { type: "text", title: "Catatan operasional", required: false },
        ],
      },
      {
        title: "Closing",
        elements: [
          { type: "choice", title: "Rekomendasi akhir", required: true, options: ["Lanjut", "Perlu perbaikan", "Tidak disarankan"] },
          { type: "signature", title: "Tanda tangan responden", required: false },
        ],
      },
    ],
  },
];

function hashStringToHue(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function getTemplatePreviewStyle(template: BuilderTemplate): CSSProperties {
  const hue = hashStringToHue(`${template.id}-${template.category}`);
  const hue2 = (hue + 35) % 360;
  const hue3 = (hue + 110) % 360;
  return {
    background: `
      radial-gradient(circle at 18% 22%, hsl(${hue} 76% 66% / 0.95) 0 24%, transparent 25%),
      radial-gradient(circle at 78% 30%, hsl(${hue2} 72% 62% / 0.9) 0 28%, transparent 29%),
      radial-gradient(circle at 55% 82%, hsl(${hue3} 68% 57% / 0.86) 0 32%, transparent 33%),
      linear-gradient(135deg, hsl(${hue} 34% 35%) 0%, hsl(${hue2} 28% 28%) 100%)
    `,
    borderColor: `hsl(${hue} 32% 48% / 0.55)`,
  };
}

function toDateTimeInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toIsoDateTime(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function formatScheduleValue(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function mapType(value: string): ElementType {
  if (value === "HeroCover") return "hero";
  if (value === "MultipleChoice") return "choice";
  if (value === "Checkbox") return "checkbox";
  if (value === "Dropdown") return "dropdown";
  if (value === "Rating") return "rating";
  if (value === "MatrixLikert") return "likert";
  if (value === "Date") return "date";
  if (value === "Signature") return "signature";
  return "text";
}

function mapTypeWithOptions(value: string, options: unknown): ElementType {
  if (value !== "MatrixLikert") {
    return mapType(value);
  }

  if (options && typeof options === "object") {
    const variant = String((options as { variant?: unknown }).variant || "").toLowerCase();
    if (variant === "matrix") return "matrix";
  }

  return "likert";
}

function toApiType(value: ElementType): string {
  if (value === "hero") return "HeroCover";
  if (value === "choice") return "MultipleChoice";
  if (value === "checkbox") return "Checkbox";
  if (value === "dropdown") return "Dropdown";
  if (value === "rating") return "Rating";
  if (value === "likert" || value === "matrix") return "MatrixLikert";
  if (value === "date") return "Date";
  if (value === "signature") return "Signature";
  return "Text";
}

function extractQuestionId(builderId: string): string | null {
  if (!builderId.startsWith("q-")) return null;
  return builderId.slice(2);
}

function normalizeUploadedMediaUrl(url?: string | null): string {
  let raw = String(url || "").trim();
  if (!raw) return "";

  raw = raw.replace(/\\/g, "/");

  if (raw.startsWith("data:")) {
    return raw;
  }

  const uploadPathMatch = raw.match(/\/uploads\/(surveys|questions|options)\/[^?#]+/i);
  if (uploadPathMatch?.[0]) {
    const uploadPath = uploadPathMatch[0].replace(/\/{2,}/g, "/");
    if (/^https?:\/\//i.test(raw)) {
      const originMatch = raw.match(/^(https?:\/\/[^/]+)/i);
      if (originMatch?.[1]) {
        return `${originMatch[1]}${uploadPath}`;
      }
    }
    return uploadPath;
  }

  if (/^https?:\/\/[^/]+\/(surveys|questions|options)\//i.test(raw)) {
    return raw.replace(/^(https?:\/\/[^/]+)\/(surveys|questions|options)\//i, "$1/uploads/$2/");
  }

  if (/^\/(surveys|questions|options)\//i.test(raw)) {
    return raw.replace(/^\/(surveys|questions|options)\//i, "/uploads/$1/");
  }

  if (/^(surveys|questions|options)\//i.test(raw)) {
    return `/uploads/${raw}`;
  }

  if (/^uploads\/(surveys|questions|options)\//i.test(raw)) {
    return `/${raw}`;
  }

  if (/^[^/\\]+\.(png|jpe?g|webp|gif|svg)$/i.test(raw)) {
    return `/uploads/questions/${raw}`;
  }

  return raw;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  if (!dataUrl.startsWith("data:")) return null;
  try {
    const response = await fetch(dataUrl);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}
function parseOptions(raw: unknown, elementType: ElementType): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v));

  if (raw && typeof raw === "object") {
    const data = raw as {
      options?: unknown[];
      rows?: unknown[];
      columns?: unknown[];
      ratingScale?: unknown;
    };

    if (elementType === "matrix" && Array.isArray(data.columns)) {
      return data.columns.map((v) => String(v));
    }

    if (elementType === "likert" && Array.isArray(data.rows)) {
      return data.rows.map((v) => String(v));
    }

    if (Array.isArray(data.options)) return data.options.map((v) => String(v));
    if (elementType === "rating" && typeof data.ratingScale !== "undefined") {
      return [String(data.ratingScale)];
    }
  }

  if (elementType === "rating") return ["10"];
  if (elementType === "likert") return ["Statement 1", "Statement 2"];
  if (elementType === "matrix") return ["Column 1", "Column 2", "Column 3"];
  return ["Option 1"];
}

function parseDataSource(raw: unknown): DataSourceType {
  if (!raw || typeof raw !== "object") return "manual";
  const value = String((raw as { dataSource?: unknown }).dataSource || "manual");
  if (
    value === "bu" ||
    value === "division" ||
    value === "department" ||
    value === "function" ||
    value === "app_department" ||
    value === "app_function"
  ) {
    return value;
  }
  return "manual";
}

function parseOptionLayout(raw: unknown, elementType: ElementType): "vertical" | "horizontal" {
  if (elementType !== "choice" && elementType !== "checkbox") return "vertical";
  if (!raw || typeof raw !== "object") return "vertical";
  const value = String((raw as { layout?: unknown }).layout || "vertical").toLowerCase();
  return value === "horizontal" ? "horizontal" : "vertical";
}

function parseAllowMultipleAnswers(raw: unknown, elementType: ElementType): boolean {
  if (elementType !== "choice") return false;
  if (!raw || typeof raw !== "object") return false;
  return Boolean((raw as { allowMultipleAnswers?: unknown }).allowMultipleAnswers);
}

function parseDisplayCondition(raw: unknown): "always" | "after_mapped_selection" {
  if (!raw || typeof raw !== "object") return "always";
  const value = String((raw as { displayCondition?: unknown }).displayCondition || "always");
  return value === "after_mapped_selection" ? "after_mapped_selection" : "always";
}

function parseConditionalRequiredSourceId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = (raw as { conditionalRequired?: { sourceElementId?: unknown } }).conditionalRequired;
  const sourceId = String(value?.sourceElementId || "").trim();
  return sourceId || undefined;
}

function parseConditionalRequiredThreshold(raw: unknown): number | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = (raw as { conditionalRequired?: { threshold?: unknown } }).conditionalRequired;
  const parsed = Number(value?.threshold);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(10, Math.max(1, Math.round(parsed)));
}

function inferProfileField(element: BuilderElement): ProfileFieldType {
  if (element.dataSource === "bu") return "bu";
  if (element.dataSource === "division") return "division";
  if (element.dataSource === "department") return "department";
  if (element.dataSource === "function") return "function";

  const title = (element.title || "").trim().toLowerCase();
  if (title.includes("business unit") || title === "bu") return "bu";
  if (title.includes("division") || title.includes("divisi") || title === "div") return "division";
  if (title.includes("department") || title.includes("departemen") || title.includes("dept")) return "department";
  if (title.includes("function")) return "function";
  return null;
}

function toPages(questions?: SurveyQuestion[]): BuilderPage[] {
  if (!questions || questions.length === 0) return [];
  const map = new Map<number, BuilderElement[]>();
  questions.forEach((q, idx) => {
    const resolvedType = mapTypeWithOptions(q.Type, q.Options);
    const page = q.PageNumber || 1;
    if (!map.has(page)) map.set(page, []);
    map.get(page)?.push({
      id: q.QuestionId ? `q-${q.QuestionId}` : `q-${idx + 1}`,
      type: resolvedType,
      title: q.PromptText || "",
      subtitle: q.Subtitle || "",
      required: Boolean(q.IsMandatory),
      options: parseOptions(q.Options, resolvedType),
      coverUrl: resolvedType === "hero" ? normalizeUploadedMediaUrl(q.ImageUrl) : "",
      dataSource: parseDataSource(q.Options),
      optionLayout: parseOptionLayout(q.Options, resolvedType),
      allowMultipleAnswers: parseAllowMultipleAnswers(q.Options, resolvedType),
      displayCondition: parseDisplayCondition(q.Options),
      conditionalRequiredSourceId: parseConditionalRequiredSourceId(q.Options),
      conditionalRequiredThreshold: parseConditionalRequiredThreshold(q.Options),
    });
  });
  return Array.from(map.entries()).sort(([a],[b])=>a-b).map(([id,elements]) => ({ id, title: id===1?"Welcome":`Page ${id}`, elements }));
}

function buildTempElementId(counter: number): string {
  return `new-${counter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getMaxTempElementCounter(pages: BuilderPage[]): number {
  let max = 0;
  pages.forEach((page) => {
    page.elements.forEach((element) => {
      const match = element.id.match(/^new-(\d+)/);
      if (match) {
        const value = Number(match[1]);
        if (!Number.isNaN(value)) {
          max = Math.max(max, value);
        }
      }
    });
  });
  return max;
}

function ensureUniqueElementIds(pages: BuilderPage[]): BuilderPage[] {
  const seen = new Set<string>();
  let duplicateCounter = 0;

  return pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) => {
      if (!seen.has(element.id)) {
        seen.add(element.id);
        return element;
      }

      duplicateCounter += 1;
      const nextId = buildTempElementId(100000 + duplicateCounter);
      seen.add(nextId);
      return { ...element, id: nextId };
    }),
  }));
}

function normalizePagesForState(pages: BuilderPage[]): { pages: BuilderPage[]; changed: boolean } {
  let changed = false;

  const normalized = pages.map((page) => {
    const seen = new Set<string>();
    let duplicateCounter = 0;

    const elements = page.elements.map((element) => {
      if (!seen.has(element.id)) {
        seen.add(element.id);
        return element;
      }

      duplicateCounter += 1;
      changed = true;
      const nextId = buildTempElementId(200000 + duplicateCounter);
      seen.add(nextId);
      return { ...element, id: nextId };
    });

    return { ...page, elements };
  });

  return { pages: normalized, changed };
}

function newElement(type: ElementType, tempId: string): BuilderElement {
  const defaultOptions =
    type === "rating"
      ? ["10"]
      : type === "likert"
        ? ["Statement 1", "Statement 2"]
        : type === "matrix"
          ? ["Column 1", "Column 2", "Column 3"]
          : ["Option 1"];

  return {
    id: tempId,
    type,
    title: type === "hero" ? "Hero title" : "Question",
    subtitle: "",
    required: false,
    options: defaultOptions,
    coverUrl: "",
    dataSource: "manual",
    optionLayout: type === "choice" || type === "checkbox" ? "vertical" : undefined,
    allowMultipleAnswers: type === "choice" ? false : undefined,
    displayCondition: "always",
    conditionalRequiredSourceId: undefined,
    conditionalRequiredThreshold: undefined,
  };
}

function getCorpTemplatePages(): BuilderPage[] {
  return [
    {
      id: 1,
      title: "Welcome",
      elements: [
        {
          id: "tpl-hero-1",
          type: "hero",
          title: "Corporate IT & BPM Survey 2026",
          subtitle: "",
          required: false,
          options: [],
          coverUrl: "",
        },
      ],
    },
    {
      id: 2,
      title: "Profil Responden",
      elements: [
        {
          id: "tpl-dropdown-1",
          type: "dropdown",
          title: "Business Unit",
          subtitle: "",
          required: true,
          options: ["Corporate", "Main Dealer", "Logistics"],
          coverUrl: "",
        },
      ],
    },
  ];
}

function isAutoTitle(title: string, id: number): boolean {
  return title === `Page ${id}`;
}

function renumberPages(pages: BuilderPage[]): BuilderPage[] {
  return pages.map((page, index) => {
    const nextId = index + 1;
    return {
      ...page,
      id: nextId,
      title: isAutoTitle(page.title, page.id) ? `Page ${nextId}` : page.title,
    };
  });
}

export default function SurveyCreatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const surveyId = searchParams.get("surveyId") || "";
  const draftKey = useMemo(() => `survey_draft_${surveyId}`, [surveyId]);
  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.userId ? String(currentUser.userId) : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasSubmittedResponses, setHasSubmittedResponses] = useState(false);

  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyDesc, setSurveyDesc] = useState("");
  const [targetRespondents, setTargetRespondents] = useState("");
  const [targetScore, setTargetScore] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");

  const [pages, setPages] = useState<BuilderPage[]>([]);
  const [elementCounter, setElementCounter] = useState(0);
  const [draggingPageId, setDraggingPageId] = useState<number | null>(null);
  const [dragOverPageId, setDragOverPageId] = useState<number | null>(null);

  const [logo, setLogo] = useState("");
  const [bgColor, setBgColor] = useState("#f5f5f5");
  const [bgImage, setBgImage] = useState("");
  const [font, setFont] = useState<FontPreset>("default");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#125ba1");
  const [secondaryColor, setSecondaryColor] = useState("#2c8dd8");
  const [buttonStyle, setButtonStyle] = useState<"rounded" | "pill" | "square">("rounded");
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [multiPage, setMultiPage] = useState(true);

  const [showSchedule, setShowSchedule] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<"all" | BuilderTemplate["category"]>("all");
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});

  const [orgBusinessUnits, setOrgBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [orgDivisions, setOrgDivisions] = useState<DivisionOption[]>([]);
  const [orgDepartments, setOrgDepartments] = useState<DepartmentOption[]>([]);
  const [orgFunctions, setOrgFunctions] = useState<FunctionMaster[]>([]);
  const [mappedApplicationsByDepartment, setMappedApplicationsByDepartment] = useState<string[]>([]);
  const [mappedApplicationsByFunction, setMappedApplicationsByFunction] = useState<string[]>([]);

  const onPageDragStart = (pageId: number) => (event: DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(pageId));
    setDraggingPageId(pageId);
  };

  const onPageDragEnd = () => {
    setDraggingPageId(null);
    setDragOverPageId(null);
  };

  const onPageDragOver = (pageId: number) => (event: DragEvent) => {
    event.preventDefault();
    if (pageId !== dragOverPageId) {
      setDragOverPageId(pageId);
    }
  };

  const onPageDrop = (pageId: number) => (event: DragEvent) => {
    event.preventDefault();
    const sourceIdRaw = event.dataTransfer.getData("text/plain");
    const sourceId = sourceIdRaw ? Number(sourceIdRaw) : draggingPageId;
    if (!sourceId || sourceId === pageId) {
      setDragOverPageId(null);
      return;
    }

    setPages((prev) => {
      const sourceIndex = prev.findIndex((p) => p.id === sourceId);
      const targetIndex = prev.findIndex((p) => p.id === pageId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return renumberPages(next);
    });

    setDraggingPageId(null);
    setDragOverPageId(null);
  };

  useEffect(() => {
    const run = async () => {
      if (!surveyId) {
        setError("surveyId tidak valid");
        setLoading(false);
        return;
      }

      const result = await fetchSurveyById(surveyId);
      setLoading(false);
      if (!result.success || !result.survey) {
        setError(result.message || "Gagal memuat survey");
        return;
      }

      const detail = result.survey;
      setSurveyTitle(detail.Title || "");
      setSurveyDesc(sanitizeSurveyDescription(detail.Description || ""));
      setTargetRespondents(detail.TargetRespondents != null ? String(detail.TargetRespondents) : "");
      setTargetScore(detail.TargetScore != null ? String(detail.TargetScore) : "");
      setScheduleStart(toDateTimeInput(detail.StartDate));
      setScheduleEnd(toDateTimeInput(detail.EndDate));
      setBgColor(detail.configuration?.BackgroundColor || "#f5f5f5");
      setBgImage(detail.configuration?.BackgroundImageUrl || "");
      setLogo(detail.configuration?.LogoUrl || "");
      setHeroTitle(detail.configuration?.HeroTitle || detail.Title || "");
      setHeroSubtitle(detail.configuration?.HeroSubtitle || sanitizeSurveyDescription(detail.Description || ""));
      setPrimaryColor(detail.configuration?.PrimaryColor || "#125ba1");
      setSecondaryColor(detail.configuration?.SecondaryColor || "#2c8dd8");
      setButtonStyle(
        detail.configuration?.ButtonStyle === "pill" || detail.configuration?.ButtonStyle === "square"
          ? detail.configuration.ButtonStyle
          : "rounded",
      );
      setShowProgressBar(detail.configuration?.ShowProgressBar !== false);
      setShowPageNumbers(detail.configuration?.ShowPageNumbers !== false);
      setMultiPage(detail.configuration?.MultiPage !== false);
      const stats = await fetchSurveyResponseStatistics(surveyId);
      setHasSubmittedResponses(stats.success && stats.totalResponses > 0);

      const local = localStorage.getItem(draftKey);
      if (local) {
        try {
          const draft = JSON.parse(local) as DraftPayload;
          const serverUpdatedAt = new Date(detail.UpdatedAt || detail.CreatedAt || 0).getTime();
          const localSavedAt = new Date(draft.savedAt || 0).getTime();
          const shouldUseLocalBackup =
            Number.isFinite(localSavedAt) &&
            localSavedAt > 0 &&
            (!Number.isFinite(serverUpdatedAt) || localSavedAt > serverUpdatedAt);

          if (shouldUseLocalBackup) {
            setSurveyTitle(draft.surveyTitle || detail.Title || "");
            setSurveyDesc(sanitizeSurveyDescription(draft.surveyDesc || detail.Description || ""));
            setTargetRespondents(draft.targetRespondents || "");
            setTargetScore(draft.targetScore || "");
            setScheduleStart(draft.scheduleStart || toDateTimeInput(detail.StartDate));
            setScheduleEnd(draft.scheduleEnd || toDateTimeInput(detail.EndDate));
            const draftPages = ensureUniqueElementIds(Array.isArray(draft.pages) ? draft.pages : []);
            setPages(draftPages);
            setElementCounter(getMaxTempElementCounter(draftPages));
            setLogo(draft.style?.logo || "");
            setBgColor(draft.style?.backgroundColor || "#f5f5f5");
            setBgImage(draft.style?.backgroundImage || "");
            setFont(draft.style?.font || "default");
            setHeroTitle(draft.style?.heroTitle || detail.configuration?.HeroTitle || detail.Title || "");
            setHeroSubtitle(draft.style?.heroSubtitle || detail.configuration?.HeroSubtitle || sanitizeSurveyDescription(detail.Description || ""));
            setPrimaryColor(draft.style?.primaryColor || detail.configuration?.PrimaryColor || "#125ba1");
            setSecondaryColor(draft.style?.secondaryColor || detail.configuration?.SecondaryColor || "#2c8dd8");
            setButtonStyle(
              draft.style?.buttonStyle === "pill" || draft.style?.buttonStyle === "square"
                ? draft.style.buttonStyle
                : detail.configuration?.ButtonStyle === "pill" || detail.configuration?.ButtonStyle === "square"
                  ? detail.configuration.ButtonStyle
                  : "rounded",
            );
            setShowProgressBar(draft.style?.showProgressBar ?? detail.configuration?.ShowProgressBar !== false);
            setShowPageNumbers(draft.style?.showPageNumbers ?? detail.configuration?.ShowPageNumbers !== false);
            setMultiPage(draft.style?.multiPage ?? detail.configuration?.MultiPage !== false);
            setMessage("Memuat backup draft lokal yang lebih baru dari server.");
            return;
          }
        } catch {
          // ignore
        }
      }

      const fromDb = toPages(detail.questions);
      if (
        fromDb.length === 0 &&
        (detail.Title || "").toLowerCase().includes("corp it") &&
        (detail.Title || "").toLowerCase().includes("bpm")
      ) {
        const templatePages = ensureUniqueElementIds(getCorpTemplatePages());
        setPages(templatePages);
        setElementCounter(getMaxTempElementCounter(templatePages));
        return;
      }

      const normalizedPages = ensureUniqueElementIds(fromDb);
      setPages(normalizedPages);
      setElementCounter(getMaxTempElementCounter(normalizedPages));
    };

    void run();
  }, [draftKey, surveyId]);

  useEffect(() => {
    const run = async () => {
      const [orgResult, functionResult] = await Promise.all([
        fetchOrgHierarchy(),
        fetchFunctionsMaster(),
      ]);

      if (orgResult.success) {
        setOrgBusinessUnits(orgResult.businessUnits);
        setOrgDivisions(orgResult.divisions);
        setOrgDepartments(orgResult.departments);
      }

      if (functionResult.success) {
        setOrgFunctions(functionResult.data.filter((item) => item.IsActive !== false));
      }
    };

    void run();
  }, []);

  useEffect(() => {
    const normalized = normalizePagesForState(pages);
    if (normalized.changed) {
      setPages(normalized.pages);
    }
  }, [pages]);

  const scheduleSummary = useMemo(() => {
    if (!scheduleStart || !scheduleEnd) return "Period not set";
    return `Period: ${formatScheduleValue(scheduleStart)} - ${formatScheduleValue(scheduleEnd)}`;
  }, [scheduleEnd, scheduleStart]);

  const styleSummary = useMemo(
    () => `Logo: ${logo ? "On" : "Off"} | Primary: ${primaryColor} | Button: ${buttonStyle} | Multi-page: ${multiPage ? "On" : "Off"}`,
    [buttonStyle, logo, multiPage, primaryColor],
  );

  const allBuilderElements = useMemo(() => pages.flatMap((page) => page.elements), [pages]);
  const profileFieldIds = useMemo(() => {
    const bu = allBuilderElements.find((item) => inferProfileField(item) === "bu");
    const division = allBuilderElements.find((item) => inferProfileField(item) === "division");
    const department = allBuilderElements.find((item) => inferProfileField(item) === "department");
    const func = allBuilderElements.find((item) => inferProfileField(item) === "function");

    return {
      buId: bu?.id || "",
      divisionId: division?.id || "",
      departmentId: department?.id || "",
      functionId: func?.id || "",
    };
  }, [allBuilderElements]);

  const selectedDepartmentId = profileFieldIds.departmentId
    ? String(previewValues[profileFieldIds.departmentId] || "")
    : "";
  const selectedFunctionId = profileFieldIds.functionId
    ? String(previewValues[profileFieldIds.functionId] || "")
    : "";

  useEffect(() => {
    const run = async () => {
      if (!selectedDepartmentId) {
        setMappedApplicationsByDepartment([]);
        return;
      }

      const mapped = await fetchMappedApplicationsByDepartment(selectedDepartmentId);
      if (!mapped.success) {
        setMappedApplicationsByDepartment([]);
        return;
      }

      setMappedApplicationsByDepartment(
        mapped.applications.map((item) => item.ApplicationName).filter(Boolean),
      );
    };

    void run();
  }, [selectedDepartmentId]);

  useEffect(() => {
    const run = async () => {
      if (!selectedFunctionId) {
        setMappedApplicationsByFunction([]);
        return;
      }

      const mapped = await fetchMappedApplicationsByFunction(selectedFunctionId);
      if (!mapped.success) {
        setMappedApplicationsByFunction([]);
        return;
      }

      setMappedApplicationsByFunction(
        mapped.applications.map((item) => item.ApplicationName).filter(Boolean),
      );
    };

    void run();
  }, [selectedFunctionId]);

  const applyMasterDataSource = (source: DataSourceType, element: BuilderElement): BuilderElement => {
    if (source === "bu") {
      return {
        ...element,
        dataSource: source,
        options: orgBusinessUnits.map((item) => item.Name),
      };
    }
    if (source === "division") {
      return {
        ...element,
        dataSource: source,
        options: orgDivisions.map((item) => item.Name),
      };
    }
    if (source === "department") {
      return {
        ...element,
        dataSource: source,
        options: orgDepartments.map((item) => item.Name),
      };
    }
    if (source === "function") {
      return {
        ...element,
        dataSource: source,
        options: orgFunctions.map((item) => item.Name),
      };
    }
    if (source === "app_department" || source === "app_function") {
      return {
        ...element,
        dataSource: source,
        options: [],
      };
    }
    return {
      ...element,
      dataSource: "manual",
      options: element.options.length > 0 ? element.options : ["Option 1"],
    };
  };

  const addPage = () => {
    setPages((prev) => {
      const nextId = prev.length + 1;
      return [...prev, { id: nextId, title: nextId === 1 ? "Welcome" : `Page ${nextId}`, elements: [] }];
    });
  };

  const addElement = (pageId: number, type: ElementType) => {
    const nextCounter = elementCounter + 1;
    const tempId = buildTempElementId(nextCounter);

    setElementCounter(nextCounter);
    setPages((prevPages) =>
      prevPages.map((page) =>
        page.id === pageId
          ? { ...page, elements: [...page.elements, newElement(type, tempId)] }
          : page,
      ),
    );
  };

  const addElementToLastPage = (type: ElementType) => {
    const nextCounter = elementCounter + 1;
    const tempId = buildTempElementId(nextCounter);

    setElementCounter(nextCounter);
    setPages((prevPages) => {
      if (prevPages.length === 0) {
        return [{ id: 1, title: "Welcome", elements: [newElement(type, tempId)] }];
      }

      const targetPageId = prevPages[prevPages.length - 1].id;
      return prevPages.map((page) =>
        page.id === targetPageId
          ? { ...page, elements: [...page.elements, newElement(type, tempId)] }
          : page,
      );
    });
  };

  const removePage = (pageId: number) => {
    setPages((prev) => renumberPages(prev.filter((page) => page.id !== pageId)));
  };

  const moveElementWithinPage = (pageId: number, elementIndex: number, direction: "up" | "down") => {
    setPages((prev) =>
      prev.map((page) => {
        if (page.id !== pageId) return page;
        const targetIndex = direction === "up" ? elementIndex - 1 : elementIndex + 1;
        if (targetIndex < 0 || targetIndex >= page.elements.length) return page;

        const nextElements = [...page.elements];
        const [moved] = nextElements.splice(elementIndex, 1);
        nextElements.splice(targetIndex, 0, moved);
        return { ...page, elements: nextElements };
      }),
    );
  };

  const validateEventSchedule = (): boolean => {
    if (scheduleStart && scheduleEnd && scheduleStart > scheduleEnd) {
      setError("Tanggal dan jam akhir harus sama atau setelah tanggal dan jam mulai");
      return false;
    }

    return true;
  };

  const isQuestionImmutableError = (message: string): boolean => {
    const value = message.toLowerCase();
    return (
      value.includes("has responses") ||
      value.includes("cannot modify question") ||
      value.includes("cannot delete question") ||
      value.includes("sudah ada data") ||
      value.includes("tidak dapat mengubah") ||
      value.includes("tidak dapat menghapus")
    );
  };
  const syncQuestionsToServer = async (): Promise<boolean> => {
    if (hasSubmittedResponses) {
      setMessage("Survey sudah memiliki respons. Sistem akan tetap mencoba menyimpan perubahan pertanyaan.");
    }

    if (!currentUserId) {
      setError("User login tidak valid untuk sinkronisasi draft");
      return false;
    }

    const remote = await fetchSurveyQuestions(surveyId);
    if (!remote.success) {
      setError(remote.message || "Gagal membaca pertanyaan dari server");
      return false;
    }

    const remoteById = new Map(remote.questions.map((q) => [q.QuestionId, q]));
    const keptIds = new Set<string>();
    const idRemap = new Map<string, string>();
    const uploadedCoverUrlByElementId = new Map<string, string>();

    const flat: Array<{ pageNumber: number; pageTitle: string; displayOrder: number; element: BuilderElement }> = [];
    let order = 1;
    pages.forEach((page, pageIndex) => {
      page.elements.forEach((element) => {
        flat.push({ pageNumber: pageIndex + 1, pageTitle: page.title, displayOrder: order, element });
        order += 1;
      });
    });

    for (const item of flat) {
      const questionId = extractQuestionId(item.element.id);
      const hasInlineHeroImage =
        item.element.type === "hero" &&
        typeof item.element.coverUrl === "string" &&
        item.element.coverUrl.startsWith("data:");
      const ratingScale = Number(item.element.options?.[0] || 10);
      const resolvedRatingScale = Number.isFinite(ratingScale)
        ? Math.min(10, Math.max(3, Math.round(ratingScale)))
        : 10;
      const payload = {
        surveyId,
        type: toApiType(item.element.type),
        promptText: item.element.title || "",
        subtitle: item.element.subtitle || null,
        imageUrl:
          item.element.type === "hero"
            ? hasInlineHeroImage
              ? null
              : item.element.coverUrl || null
            : null,
        isMandatory: item.element.required,
        displayOrder: item.displayOrder,
        pageNumber: item.pageNumber,
        layoutOrientation: "vertical" as const,
        options: (() => {
          const pageMeta = item.pageTitle?.trim()
            ? { pageTitle: item.pageTitle.trim() }
            : {};
          const displayCondition =
            item.element.displayCondition && item.element.displayCondition !== "always"
              ? { displayCondition: item.element.displayCondition }
              : {};
          const conditionalRequired =
            (item.element.conditionalRequiredSourceId
              ? {
                  conditionalRequired: {
                    sourceElementId:
                      idRemap.get(item.element.conditionalRequiredSourceId) ||
                      item.element.conditionalRequiredSourceId,
                    threshold: Math.min(
                      10,
                      Math.max(1, Math.round(Number(item.element.conditionalRequiredThreshold || 7))),
                    ),
                  },
                }
              : {});

          if (["choice", "checkbox", "dropdown"].includes(item.element.type)) {
            return {
              options: item.element.options,
              dataSource: item.element.dataSource || "manual",
              ...(item.element.type === "choice" || item.element.type === "checkbox"
                ? { layout: item.element.optionLayout || "vertical" }
                : {}),
              ...(item.element.type === "choice"
                ? { allowMultipleAnswers: Boolean(item.element.allowMultipleAnswers) }
                : {}),
              ...pageMeta,
              ...displayCondition,
              ...conditionalRequired,
            };
          }
          if (item.element.type === "likert") return { variant: "likert", rows: item.element.options, ...pageMeta, ...displayCondition, ...conditionalRequired };
          if (item.element.type === "matrix") return { variant: "matrix", columns: item.element.options, ...pageMeta, ...displayCondition, ...conditionalRequired };
          if (item.element.type === "rating") return { ratingScale: resolvedRatingScale, ...pageMeta, ...displayCondition, ...conditionalRequired };
          if (Object.keys(displayCondition).length > 0 || Object.keys(conditionalRequired).length > 0) {
            return { ...pageMeta, ...displayCondition, ...conditionalRequired };
          }
          return Object.keys(pageMeta).length > 0 ? pageMeta : null;
        })(),
      };

      if (questionId && remoteById.has(questionId)) {
        const updated = await updateSurveyQuestion(questionId, {
          ...payload,
          updatedBy: currentUserId,
        });
        if (!updated.success) {
          if (isQuestionImmutableError(updated.message || "")) {
            setError("Survey sudah memiliki respons. Perubahan pertanyaan (termasuk data source) tidak dapat disimpan.");
            return false;
          }

          setError(updated.message || "Gagal memperbarui pertanyaan");
          return false;
        }
        keptIds.add(questionId);
        if (hasInlineHeroImage) {
          const imageBlob = await dataUrlToBlob(item.element.coverUrl);
          if (!imageBlob) {
            setError("Gagal memproses file hero cover");
            return false;
          }

          const uploaded = await uploadSurveyQuestionImage(questionId, imageBlob, `hero-${questionId}.png`);
          if (!uploaded.success || !uploaded.imageUrl) {
            setError(uploaded.message || "Gagal upload hero cover");
            return false;
          }
          uploadedCoverUrlByElementId.set(item.element.id, uploaded.imageUrl);
        }
      } else {
        const created = await createSurveyQuestion({
          ...payload,
          createdBy: currentUserId,
        });
        if (!created.success || !created.question) {
          if (isQuestionImmutableError(created.message || "")) {
            setError("Survey sudah memiliki respons. Perubahan pertanyaan (termasuk data source) tidak dapat disimpan.");
            return false;
          }

          setError(created.message || "Gagal menambah pertanyaan");
          return false;
        }
        keptIds.add(created.question.QuestionId);
        idRemap.set(item.element.id, `q-${created.question.QuestionId}`);
        if (hasInlineHeroImage) {
          const imageBlob = await dataUrlToBlob(item.element.coverUrl);
          if (!imageBlob) {
            setError("Gagal memproses file hero cover");
            return false;
          }

          const uploaded = await uploadSurveyQuestionImage(
            created.question.QuestionId,
            imageBlob,
            `hero-${created.question.QuestionId}.png`,
          );
          if (!uploaded.success || !uploaded.imageUrl) {
            setError(uploaded.message || "Gagal upload hero cover");
            return false;
          }
          uploadedCoverUrlByElementId.set(item.element.id, uploaded.imageUrl);
        }
      }
    }

    for (const question of remote.questions) {
      if (keptIds.has(question.QuestionId)) continue;
      const removed = await deleteSurveyQuestion(question.QuestionId);
      if (!removed.success) {
        const message = (removed.message || "").toLowerCase();
        if (isQuestionImmutableError(message)) {
          setError("Survey sudah memiliki respons. Perubahan pertanyaan (termasuk data source) tidak dapat disimpan.");
          return false;
        }

        setError(removed.message || "Gagal menghapus pertanyaan yang sudah dihapus dari builder");
        return false;
      }
    }

    if (idRemap.size > 0 || uploadedCoverUrlByElementId.size > 0) {
      setPages((prev) =>
        prev.map((page) => ({
          ...page,
          elements: page.elements.map((element) => ({
            ...element,
            id: idRemap.get(element.id) || element.id,
            coverUrl: uploadedCoverUrlByElementId.get(element.id) || element.coverUrl,
            conditionalRequiredSourceId: element.conditionalRequiredSourceId
              ? idRemap.get(element.conditionalRequiredSourceId) || element.conditionalRequiredSourceId
              : undefined,
          })),
        })),
      );
    }

    return true;
  };
  const saveDraft = async () => {
    setError("");
    setMessage("");
    if (!validateEventSchedule()) {
      return;
    }

    const payload: DraftPayload = {
      surveyTitle,
      surveyDesc: sanitizeSurveyDescription(surveyDesc),
      targetRespondents,
      targetScore,
      scheduleStart,
      scheduleEnd,
      pages,
      savedAt: new Date().toISOString(),
      style: {
        logo,
        backgroundColor: bgColor,
        backgroundImage: bgImage,
        font,
        heroTitle,
        heroSubtitle,
        primaryColor,
        secondaryColor,
        buttonStyle,
        showProgressBar,
        showPageNumbers,
        multiPage,
      },
    };

    localStorage.setItem(draftKey, JSON.stringify(payload));

    const synced = await syncQuestionsToServer();
    if (!synced) {
      return;
    }

        const parsedTargetRespondents =
      targetRespondents.trim() === "" ? undefined : Number(targetRespondents);
    const parsedTargetScore =
      targetScore.trim() === "" ? undefined : Number(targetScore);

    const updatePayload: Parameters<typeof updateEventById>[1] = {
      title: surveyTitle || "Untitled Survey",
      description: sanitizeSurveyDescription(surveyDesc),
      status: "Draft",
      targetRespondents: Number.isFinite(parsedTargetRespondents)
        ? parsedTargetRespondents
        : undefined,
      targetScore: Number.isFinite(parsedTargetScore) ? parsedTargetScore : undefined,
    };
    updatePayload.startDate = toIsoDateTime(scheduleStart);
    updatePayload.endDate = toIsoDateTime(scheduleEnd);

    setSaving(true);
    const update = await updateEventById(surveyId, updatePayload);
    setSaving(false);

    if (!update.success) {
      setError(update.message || "Draft lokal tersimpan, sinkron server gagal");
      return;
    }

    const configUpdate = await updateEventConfiguration(surveyId, {
      HeroTitle: heroTitle || surveyTitle || null,
      HeroSubtitle: heroSubtitle || sanitizeSurveyDescription(surveyDesc) || null,
      LogoUrl: logo || null,
      BackgroundColor: bgColor || null,
      BackgroundImageUrl: bgImage || null,
      FontFamily: font === "default" ? null : font,
      PrimaryColor: primaryColor || null,
      SecondaryColor: secondaryColor || null,
      ButtonStyle: buttonStyle,
      ShowProgressBar: showProgressBar,
      ShowPageNumbers: showPageNumbers,
      MultiPage: multiPage,
    });
    if (!configUpdate.success) {
      setMessage("Draft tersimpan, tetapi style belum tersimpan ke server.");
      return;
    }

    const verifyDraft = await fetchSurveyById(surveyId);
    if (!verifyDraft.success || !verifyDraft.survey) {
      setError("Draft tersimpan, tetapi verifikasi status gagal.");
      return;
    }
    const latestStatus = verifyDraft.survey.Status || "";
    if (latestStatus !== "Draft") {
      setError(`Status belum berubah ke Draft (status saat ini: ${latestStatus || "-"})`);
      return;
    }

    setMessage("Draft tersimpan");
  };

  const publish = async () => {
    setError("");
    setMessage("");
    if (!validateEventSchedule()) {
      return;
    }

    if (!canPublishEvent(toIsoDateTime(scheduleEnd))) {
      setError("Publish tidak dapat dilakukan karena tanggal dan jam akhir event sudah lewat. Status event seharusnya Closed.");
      return;
    }

    const hasQuestion = pages.some((page) => page.elements.length > 0);
    if (!hasQuestion) {
      setError("Minimal ada 1 pertanyaan sebelum publish");
      return;
    }

    setPublishing(true);

    const synced = await syncQuestionsToServer();
    if (!synced) {
      setPublishing(false);
      return;
    }
        const parsedTargetRespondents =
      targetRespondents.trim() === "" ? undefined : Number(targetRespondents);
    const parsedTargetScore =
      targetScore.trim() === "" ? undefined : Number(targetScore);

    const updatePayload: Parameters<typeof updateEventById>[1] = {
      title: surveyTitle || "Untitled Survey",
      description: sanitizeSurveyDescription(surveyDesc),
      status: "Active",
      targetRespondents: Number.isFinite(parsedTargetRespondents)
        ? parsedTargetRespondents
        : undefined,
      targetScore: Number.isFinite(parsedTargetScore) ? parsedTargetScore : undefined,
    };
    updatePayload.startDate = toIsoDateTime(scheduleStart);
    updatePayload.endDate = toIsoDateTime(scheduleEnd);

    const update = await updateEventById(surveyId, updatePayload);
    setPublishing(false);

    if (!update.success) {
      setError(update.message || "Gagal publish");
      return;
    }

    const configUpdate = await updateEventConfiguration(surveyId, {
      HeroTitle: heroTitle || surveyTitle || null,
      HeroSubtitle: heroSubtitle || sanitizeSurveyDescription(surveyDesc) || null,
      LogoUrl: logo || null,
      BackgroundColor: bgColor || null,
      BackgroundImageUrl: bgImage || null,
      FontFamily: font === "default" ? null : font,
      PrimaryColor: primaryColor || null,
      SecondaryColor: secondaryColor || null,
      ButtonStyle: buttonStyle,
      ShowProgressBar: showProgressBar,
      ShowPageNumbers: showPageNumbers,
      MultiPage: multiPage,
    });
    if (!configUpdate.success) {
      setError(configUpdate.message || "Publish berhasil, namun style belum tersimpan.");
      return;
    }

    const verifyActive = await fetchSurveyById(surveyId);
    if (!verifyActive.success || !verifyActive.survey) {
      setError("Publish berhasil, tetapi verifikasi status gagal.");
      return;
    }
    const latestStatus = resolveEventStatus(verifyActive.survey);
    if (latestStatus !== "Active") {
      setError(`Status belum berubah ke Active (status saat ini: ${latestStatus || "-"})`);
      return;
    }

    router.push(`/admin/event-management/${surveyId}/operations`);
  };

  const onFile = (file: File | undefined, setter: (value: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const setPreviewValue = (id: string, value: unknown) => {
    setPreviewValues((prev) => ({ ...prev, [id]: value }));
  };

  const setPreviewValuesBulk = (nextValues: Record<string, unknown>) => {
    setPreviewValues((prev) => ({ ...prev, ...nextValues }));
  };

  const togglePreviewCheckbox = (id: string, option: string) => {
    setPreviewValues((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const next = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
      return { ...prev, [id]: next };
    });
  };

  const hasSelectedPreviewValue = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    return false;
  };

  const getMappedSelectionValues = (
    selector: BuilderElement | null,
    values: Record<string, unknown>,
  ): string[] => {
    if (!selector) return [];
    const raw = values[selector.id];

    if (Array.isArray(raw)) {
      return Array.from(
        new Set(raw.map((item) => String(item || "").trim()).filter(Boolean)),
      );
    }

    if (typeof raw === "string" && raw.trim()) {
      return [raw.trim()];
    }

    return [];
  };

  const toContextElementId = (baseId: string, appName: string): string => {
    const safe = encodeURIComponent(appName.trim().toLowerCase());
    return `${baseId}__app__${safe || "selected"}`;
  };

  const isConditionallyRequired = (
    element: BuilderElement,
    values: Record<string, unknown>,
  ): boolean => {
    if (!element.conditionalRequiredSourceId) return false;
    const threshold = Math.min(
      10,
      Math.max(1, Math.round(Number(element.conditionalRequiredThreshold || 7))),
    );
    const sourceId = element.conditionalRequiredSourceId;
    const directValue = Number(values[sourceId] || 0);

    let sourceValue = Number.isFinite(directValue) && directValue > 0 ? directValue : 0;
    if (sourceValue <= 0) {
      const rowValues = Object.entries(values)
        .filter(([key]) => key.startsWith(`${sourceId}-`))
        .map(([, value]) => {
          const text = String(value ?? "").trim();
          const parsed = Number(text);
          if (Number.isFinite(parsed)) {
            return parsed;
          }
          return null;
        })
        .filter((value): value is number => value !== null && value > 0);

      if (rowValues.length > 0) {
        sourceValue = rowValues.reduce((sum, current) => sum + current, 0) / rowValues.length;
      }
    }

    if (!Number.isFinite(sourceValue) || sourceValue <= 0) return false;
    return sourceValue < threshold;
  };

  const hasMappedSelectorInPage = (elements: BuilderElement[]): boolean =>
    elements.some(
      (item) =>
        (item.type === "choice" || item.type === "checkbox" || item.type === "dropdown") &&
        (item.dataSource === "app_department" || item.dataSource === "app_function"),
    );

  const shouldShowVisibilityControl = (elements: BuilderElement[], elementIndex: number): boolean => {
    const mappedSelectorIndex = elements.findIndex(
      (item) =>
        (item.type === "choice" || item.type === "checkbox" || item.type === "dropdown") &&
        (item.dataSource === "app_department" || item.dataSource === "app_function"),
    );
    if (mappedSelectorIndex === -1 || elementIndex <= mappedSelectorIndex) return false;
    const current = elements[elementIndex];
    return ["rating", "likert", "matrix", "text", "date", "signature", "choice", "checkbox", "dropdown"].includes(current.type);
  };

  const hasBuilderContent = useMemo(
    () => pages.some((page) => page.elements.length > 0),
    [pages],
  );

  const filteredTemplates = useMemo(() => {
    const term = templateSearch.trim().toLowerCase();
    return BUILDER_TEMPLATES.filter((item) => {
      if (templateCategory !== "all" && item.category !== templateCategory) return false;
      if (!term) return true;
      return `${item.name} ${item.description}`.toLowerCase().includes(term);
    });
  }, [templateCategory, templateSearch]);

  const elementIconMap = useMemo(
    () =>
      ELEMENTS.reduce<Record<ElementType, string>>((acc, item) => {
        acc[item.type] = item.icon;
        return acc;
      }, {} as Record<ElementType, string>),
    [],
  );

  const selectedTemplate = useMemo(
    () => BUILDER_TEMPLATES.find((item) => item.id === selectedTemplateId) || null,
    [selectedTemplateId],
  );

  const applyTemplate = (template: BuilderTemplate) => {
    let nextCounter = elementCounter;
    const indexedElements: BuilderElement[] = [];

    const nextPages: BuilderPage[] = template.pages.map((page, pageIndex) => {
      const nextElements: BuilderElement[] = page.elements.map((element) => {
        nextCounter += 1;
        const newId = buildTempElementId(nextCounter);
        const nextElement: BuilderElement = {
          id: newId,
          type: element.type,
          title: element.title,
          subtitle: element.subtitle || "",
          required: Boolean(element.required),
          options: Array.isArray(element.options) && element.options.length > 0
            ? [...element.options]
            : parseOptions(undefined, element.type),
          coverUrl: "",
          dataSource: element.dataSource || "manual",
          optionLayout: element.optionLayout || (element.type === "choice" || element.type === "checkbox" ? "vertical" : undefined),
          allowMultipleAnswers: element.type === "choice" ? Boolean(element.allowMultipleAnswers) : undefined,
          displayCondition: element.displayCondition || "always",
          conditionalRequiredSourceId: undefined,
          conditionalRequiredThreshold: element.conditionalRequiredThreshold,
        };
        indexedElements.push(nextElement);
        return nextElement;
      });

      return {
        id: pageIndex + 1,
        title: page.title,
        elements: nextElements,
      };
    });

    template.pages.forEach((page, pageIndex) => {
      page.elements.forEach((element, elementIndex) => {
        if (!element.conditionalRequiredSourceIndex && element.conditionalRequiredSourceIndex !== 0) return;
        const sourceIdx = element.conditionalRequiredSourceIndex;
        const currentOffset = template.pages
          .slice(0, pageIndex)
          .reduce((sum, item) => sum + item.elements.length, 0);
        const currentAbsolute = currentOffset + elementIndex;
        const sourceAbsolute = currentOffset + sourceIdx;
        if (sourceAbsolute < 0 || sourceAbsolute >= indexedElements.length) return;
        if (currentAbsolute < 0 || currentAbsolute >= indexedElements.length) return;
        indexedElements[currentAbsolute].conditionalRequiredSourceId = indexedElements[sourceAbsolute].id;
        if (!indexedElements[currentAbsolute].conditionalRequiredThreshold) {
          indexedElements[currentAbsolute].conditionalRequiredThreshold = 7;
        }
      });
    });

    const normalized = ensureUniqueElementIds(renumberPages(nextPages));
    setPages(normalized);
    setElementCounter(nextCounter);
    setShowTemplatePicker(false);
    setShowTemplateConfirm(false);
    setSelectedTemplateId("");
    setTemplateSearch("");
    setTemplateCategory("all");
    setMessage(`Template "${template.name}" berhasil diterapkan. Klik Save Draft untuk menyimpan ke server.`);
  };

  const onSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const onApplySelectedTemplate = () => {
    if (!selectedTemplate) return;
    if (hasBuilderContent) {
      setShowTemplateConfirm(true);
      return;
    }
    applyTemplate(selectedTemplate);
  };

  if (loading) return <section className={styles.loading}>Memuat survey builder...</section>;

  return (
    <section className={styles.wrapper}>
      {error ? <div className={styles.alertError}>{error}</div> : null}
      {message ? <div className={styles.alertSuccess}>{message}</div> : null}

      {showPreview ? (
        <div className={styles.previewScreen}>
          <div className={styles.previewTopbar}>
            <div>
              <h2 className={styles.previewTitle}>Survey Preview</h2>
              <div className={styles.previewSub}>Mode tampilan responden</div>
            </div>
            <div className={styles.previewDeviceTabs} role="tablist" aria-label="Preview device mode">
              <button
                type="button"
                role="tab"
                aria-label="Computer View"
                aria-selected={previewDevice === "desktop"}
                className={`${styles.previewDeviceTab} ${previewDevice === "desktop" ? styles.previewDeviceTabActive : ""}`}
                onClick={() => setPreviewDevice("desktop")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4.25 3h15.5A2.25 2.25 0 0 1 22 5.25v10.5A2.25 2.25 0 0 1 19.75 18h-4.25v2.5h1.75a.75.75 0 1 1 0 1.5H6.75a.75.75 0 1 1 0-1.5H8.5V18H4.25A2.25 2.25 0 0 1 2 15.75V5.25A2.25 2.25 0 0 1 4.25 3Zm5.75 17.5h4V18h-4v2.5Z" />
                </svg>
                <span>Computer</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-label="Mobile View"
                aria-selected={previewDevice === "mobile"}
                className={`${styles.previewDeviceTab} ${previewDevice === "mobile" ? styles.previewDeviceTabActive : ""}`}
                onClick={() => setPreviewDevice("mobile")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.25 2h7.5A2.25 2.25 0 0 1 18 4.25v15.5A2.25 2.25 0 0 1 15.75 22h-7.5A2.25 2.25 0 0 1 6 19.75V4.25A2.25 2.25 0 0 1 8.25 2Zm0 1.5a.75.75 0 0 0-.75.75v15.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 .75-.75V4.25a.75.75 0 0 0-.75-.75h-7.5Z" />
                </svg>
                <span>Mobile</span>
              </button>
            </div>
            <button className={styles.inlineButton} type="button" onClick={() => setShowPreview(false)}>Back to Form Builder</button>
          </div>
          <div className={styles.previewViewportWrap}>
            <div
              className={`${styles.previewViewport} ${
                previewDevice === "mobile" ? styles.previewViewportMobile : styles.previewViewportDesktop
              }`}
            >
              <div className={styles.previewFullBody}>
                {logo ? (
                  <div className={styles.previewSurveyBrand}>
                    <img src={logo} alt="Survey logo" className={styles.previewSurveyLogo} />
                  </div>
                ) : null}
                <h3>{surveyTitle || "Survey Title"}</h3>
                {surveyDesc.trim() ? <p>{surveyDesc}</p> : null}
                {pages.map((p) => (
                  <div key={`pv-${p.id}`} className={styles.previewPage}>
                    <h4>{p.title}</h4>
                    {(() => {
                  const mappedSelectorIndex = p.elements.findIndex(
                    (item) =>
                      (item.type === "choice" || item.type === "checkbox" || item.type === "dropdown") &&
                      (item.dataSource === "app_department" || item.dataSource === "app_function"),
                  );

                  const mappedSelector = mappedSelectorIndex >= 0 ? p.elements[mappedSelectorIndex] : null;
                  const selectedMappedApps = getMappedSelectionValues(mappedSelector, previewValues);

                  const beforeSelector = mappedSelectorIndex >= 0
                    ? p.elements.slice(0, mappedSelectorIndex + 1)
                    : p.elements;
                  const afterSelector = mappedSelectorIndex >= 0 ? p.elements.slice(mappedSelectorIndex + 1) : [];
                  const repeatableAfterSelector = afterSelector.filter(
                    (item) => item.displayCondition === "after_mapped_selection",
                  );
                  const alwaysVisibleAfterSelector = afterSelector.filter(
                    (item) => item.displayCondition !== "after_mapped_selection",
                  );

                  return (
                    <>
                      {beforeSelector.map((el, elIndex) => (
                        <div key={`pve-base-${p.id}-${el.id}-${elIndex}`} className={styles.previewQuestion}>
                          {(() => {
                            const effectiveRequired = el.required || isConditionallyRequired(el, previewValues);
                            const effectiveElement = { ...el, required: effectiveRequired };
                            return (
                              <>
                                {effectiveElement.type !== "hero" && effectiveElement.title.trim()
                                  ? <div className={styles.previewLabel}>{effectiveElement.title}{effectiveElement.required ? " *" : ""}</div>
                                  : null}
                                {effectiveElement.type !== "hero" && effectiveElement.subtitle ? <small>{effectiveElement.subtitle}</small> : null}
                                <SurveyPreviewElement
                                  element={effectiveElement}
                                  allElements={allBuilderElements}
                                  values={previewValues}
                                  onSetValue={setPreviewValue}
                                  onSetValuesBulk={setPreviewValuesBulk}
                                  onToggleCheckbox={togglePreviewCheckbox}
                                  orgData={{
                                    businessUnits: orgBusinessUnits,
                                    divisions: orgDivisions,
                                    departments: orgDepartments,
                                    functions: orgFunctions,
                                    mappedApplicationsByDepartment,
                                    mappedApplicationsByFunction,
                                  }}
                                />
                              </>
                            );
                          })()}
                        </div>
                      ))}

                      {mappedSelector && repeatableAfterSelector.length > 0 && hasSelectedPreviewValue(previewValues[mappedSelector.id]) ? (
                        selectedMappedApps.map((appName) => (
                          <div key={`pve-app-group-${p.id}-${appName}`} className={styles.previewAppGroup}>
                            <div className={styles.previewAppGroupTitle}>{appName}</div>
                            {repeatableAfterSelector.map((el, elIndex) => {
                              const contextSourceId = el.conditionalRequiredSourceId
                                ? toContextElementId(el.conditionalRequiredSourceId, appName)
                                : undefined;
                              const contextElement = {
                                ...el,
                                id: toContextElementId(el.id, appName),
                                title: `${el.title || "Question"} (${appName})`,
                                conditionalRequiredSourceId: contextSourceId,
                              };
                              const effectiveRequired = contextElement.required || isConditionallyRequired(contextElement, previewValues);
                              const effectiveElement = { ...contextElement, required: effectiveRequired };
                              return (
                                <div key={`pve-app-${p.id}-${el.id}-${elIndex}-${appName}`} className={styles.previewQuestion}>
                                  {effectiveElement.type !== "hero" ? <div className={styles.previewLabel}>{effectiveElement.title}{effectiveElement.required ? " *" : ""}</div> : null}
                                  {effectiveElement.type !== "hero" && effectiveElement.subtitle ? <small>{effectiveElement.subtitle}</small> : null}
                                  <SurveyPreviewElement
                                    element={effectiveElement}
                                    allElements={allBuilderElements}
                                    values={previewValues}
                                    onSetValue={setPreviewValue}
                                    onSetValuesBulk={setPreviewValuesBulk}
                                    onToggleCheckbox={togglePreviewCheckbox}
                                    orgData={{
                                      businessUnits: orgBusinessUnits,
                                      divisions: orgDivisions,
                                      departments: orgDepartments,
                                      functions: orgFunctions,
                                      mappedApplicationsByDepartment,
                                      mappedApplicationsByFunction,
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ))
                      ) : null}

                      {alwaysVisibleAfterSelector.map((el, elIndex) => (
                        <div key={`pve-always-${p.id}-${el.id}-${elIndex}`} className={styles.previewQuestion}>
                          {(() => {
                            const effectiveRequired = el.required || isConditionallyRequired(el, previewValues);
                            const effectiveElement = { ...el, required: effectiveRequired };
                            return (
                              <>
                                {effectiveElement.type !== "hero" && effectiveElement.title.trim()
                                  ? <div className={styles.previewLabel}>{effectiveElement.title}{effectiveElement.required ? " *" : ""}</div>
                                  : null}
                                {effectiveElement.type !== "hero" && effectiveElement.subtitle ? <small>{effectiveElement.subtitle}</small> : null}
                                <SurveyPreviewElement
                                  element={effectiveElement}
                                  allElements={allBuilderElements}
                                  values={previewValues}
                                  onSetValue={setPreviewValue}
                                  onSetValuesBulk={setPreviewValuesBulk}
                                  onToggleCheckbox={togglePreviewCheckbox}
                                  orgData={{
                                    businessUnits: orgBusinessUnits,
                                    divisions: orgDivisions,
                                    departments: orgDepartments,
                                    functions: orgFunctions,
                                    mappedApplicationsByDepartment,
                                    mappedApplicationsByFunction,
                                  }}
                                />
                              </>
                            );
                          })()}
                        </div>
                      ))}
                    </>
                  );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.builder}>
          <aside className={styles.builderSidebar}>
            <div className={styles.sidebarSection}>
              <div className={styles.sidebarTitle}>Add Elements</div>
              {ELEMENTS.map((item) => (
                <button
                  key={item.type}
                  className={styles.typeBtn}
                  onClick={() => addElementToLastPage(item.type)}
                  type="button"
                >
                  <span className={styles.typeIcon}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            <div className={styles.sidebarSection}>
              <div className={styles.sidebarTitle}>Templates</div>
              <button className={styles.sideAction} type="button" onClick={() => setShowTemplatePicker(true)}>Load Template</button>
            </div>

            <div className={styles.sidebarSection}>
              <div className={styles.sidebarTitle}>Actions</div>
              <Link className={styles.sideAction} href="/admin/event-management">Back to Event Management</Link>
              <button className={styles.sideAction} type="button" onClick={() => setShowPreview(true)}>Preview</button>
              <button className={styles.sideAction} type="button" onClick={() => void saveDraft()} disabled={saving}>{saving ? "Saving..." : "Save Draft"}</button>
              <button className={styles.sideActionPrimary} type="button" onClick={() => void publish()} disabled={publishing}>{publishing ? "Publishing..." : "Publish"}</button>
            </div>
          </aside>

          <main className={styles.builderMain} style={{ backgroundColor: bgColor, backgroundImage: bgImage ? `url(${bgImage})` : "none", fontFamily: FONT_MAP[font] }}>
            <div className={styles.canvas}>
              <div className={styles.topbar}>
                <div className={styles.topLeft}><div className={styles.topTitle}>Survey Builder</div><div className={styles.topSub}>{scheduleSummary}</div></div>
                <div className={styles.topCenter}>
                  <div className={styles.targetCard}>
                    <div className={styles.targetTitle}>Target Survey</div>
                    <div className={styles.targetGrid}>
                      <label>Target Responden<input type="number" placeholder="Contoh: 100" value={targetRespondents} onChange={(e)=>setTargetRespondents(e.target.value)} /></label>
                      <label>Target Score (1-10)<input type="number" min={1} max={10} step="0.1" placeholder="Contoh: 8.5" value={targetScore} onChange={(e)=>setTargetScore(e.target.value)} /></label>
                    </div>
                  </div>
                </div>
                <div className={styles.topActions}>
                  <button className={styles.inlineButton} type="button" onClick={() => setShowSchedule(true)}>Settings</button>
                  <button className={styles.inlineButton} type="button" onClick={() => setShowStyle(true)}>Style</button>
                </div>
              </div>

              <div className={styles.brandPreview}>
                <div className={styles.brandLogo}>{logo ? <img src={logo} alt="Logo" /> : <span>Your Logo</span>}</div>
                <div>
                  <div className={styles.brandLabel}>{heroTitle || surveyTitle || "Survey Hero Title"}</div>
                  <div className={styles.brandText}>
                    {heroSubtitle || sanitizeSurveyDescription(surveyDesc) || styleSummary}
                  </div>
                </div>
              </div>

              <div className={styles.surveyCard}>
                <input className={styles.surveyTitle} placeholder="Survey Title" value={surveyTitle} onChange={(e)=>setSurveyTitle(e.target.value)} />
                <input className={styles.surveyDesc} placeholder="Survey description" value={surveyDesc} onChange={(e)=>setSurveyDesc(sanitizeSurveyDescription(e.target.value))} />
              </div>

              <div className={styles.pagesWrap}>
                {pages.length === 0 ? <div className={styles.emptyPage}>No pages yet. Use Add Page to get started.</div> : null}

              {pages.map((page) => (
                <article key={page.id} className={[styles.pageCard, draggingPageId === page.id ? styles.pageCardDragging : "", dragOverPageId === page.id && draggingPageId !== page.id ? styles.pageCardDragOver : ""].join(" ") } onDragOver={onPageDragOver(page.id)} onDrop={onPageDrop(page.id)}>
                  <div className={styles.pageHeader}>
                    <div className={styles.pageTitleWrap}><span className={styles.drag} draggable onDragStart={onPageDragStart(page.id)} onDragEnd={onPageDragEnd} aria-label="Drag page">{"\u2630"}</span><input value={page.title} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,title:e.target.value}:p))} className={styles.pageTitleInput} /></div>
                    <button className={styles.inlineButton} type="button" onClick={() => removePage(page.id)}>Delete Page</button>
                  </div>

                  {page.elements.map((el, elIndex) => (
                    <div key={`${el.id}-${elIndex}`} className={styles.elementCard}>
                      <div className={styles.elementType}>{el.type}</div>
                      <input className={styles.questionInput} value={el.title} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,title:e.target.value}:item)}:p))} placeholder="Question" />
                      <input className={styles.questionSub} value={el.subtitle} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,subtitle:e.target.value}:item)}:p))} placeholder="Subtitle (optional)" />

                      {el.type === "text" ? (
                        <div className={styles.builderFieldPreview}>
                          <input className={styles.builderFieldInput} type="text" disabled placeholder={el.title || "Text input"} />
                        </div>
                      ) : null}

                      {el.type === "date" ? (
                        <div className={styles.builderFieldPreview}>
                          <input className={styles.builderFieldInput} type="date" disabled />
                        </div>
                      ) : null}

                      {el.type === "signature" ? (
                        <div className={styles.builderFieldPreview}>
                          <div className={styles.builderSignatureBox}>Klik tombol di bawah untuk menandatangani</div>
                          <button type="button" className={styles.inlineButton} disabled>
                            Tanda Tangan
                          </button>
                        </div>
                      ) : null}

                      {el.type === "hero" ? (
                        <label className={styles.coverUpload}>
                          {el.coverUrl ? <img src={el.coverUrl} alt="cover" className={styles.coverImg} /> : "Click to upload cover image"}
                          <input type="file" accept="image/*" onChange={(ev)=>onFile(ev.target.files?.[0], (value)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,coverUrl:value}:item)}:p)))} />
                        </label>
                      ) : null}

                                            {(["choice","checkbox","dropdown"] as ElementType[]).includes(el.type) ? (
                        <div className={styles.optionList}>
                          <div className={styles.dataSourcePanel}>
                            <label className={styles.dataSourceLabel}>Data Source:</label>
                            <select
                              className={styles.dataSourceSelect}
                              value={el.dataSource || "manual"}
                              onChange={(e) => {
                                const selected = e.target.value as DataSourceType;
                                setPages((prev) =>
                                  prev.map((p) =>
                                    p.id === page.id
                                      ? {
                                          ...p,
                                          elements: p.elements.map((item) =>
                                            item.id === el.id
                                              ? applyMasterDataSource(selected, item)
                                              : item,
                                          ),
                                        }
                                      : p,
                                  ),
                                );
                              }}
                            >
                              <option value="manual">Manual Input</option>
                              <option value="bu">Master: Business Unit</option>
                              <option value="division">Master: Division</option>
                              <option value="department">Master: Department</option>
                              <option value="function">Master: Function</option>
                              <option value="app_department">Mapped: Applications by Department</option>
                              <option value="app_function">Mapped: Applications by Function</option>
                            </select>
                            {el.dataSource && el.dataSource !== "manual" ? <span className={styles.dataSourceBadge}>Using master data</span> : null}
                          </div>

                          {el.options.map((opt, idx) => (
                            <div key={`${el.id}-${idx}`} className={styles.optionRow}>
                              <input
                                value={opt}
                                disabled={el.dataSource !== "manual"}
                                onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.map((ov,oi)=>oi===idx?e.target.value:ov)}:item)}:p))}
                              />
                              <button
                                type="button"
                                className={styles.optionDelete}
                                disabled={el.dataSource !== "manual"}
                                onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.length>1?item.options.filter((_,oi)=>oi!==idx):item.options}:item)}:p))}
                              >
                                {"\u00D7"}
                              </button>
                            </div>
                          ))}

                          {el.dataSource === "manual" ? (
                            <button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:[...item.options,`Option ${item.options.length+1}`]}:item)}:p))}>+ Add option</button>
                          ) : null}
                          {el.dataSource === "app_department" ? (
                            <div className={styles.mappingHint}>
                              Options akan diisi otomatis dari mapping aplikasi berdasarkan Department yang dipilih di preview.
                            </div>
                          ) : null}
                          {el.dataSource === "app_function" ? (
                            <div className={styles.mappingHint}>
                              Options akan diisi otomatis dari mapping aplikasi berdasarkan Function yang dipilih di preview.
                            </div>
                          ) : null}

                          {(el.type === "choice" || el.type === "checkbox") ? (
                            <div className={styles.settingPanel}>
                              <div className={styles.settingRow}>
                                <label className={styles.settingLabel}>Layout</label>
                                <select
                                  className={styles.settingSelect}
                                  value={el.optionLayout || "vertical"}
                                  onChange={(e) =>
                                    setPages((prev) =>
                                      prev.map((p) =>
                                        p.id === page.id
                                          ? {
                                              ...p,
                                              elements: p.elements.map((item) =>
                                                item.id === el.id
                                                  ? { ...item, optionLayout: e.target.value as "vertical" | "horizontal" }
                                                  : item,
                                              ),
                                            }
                                          : p,
                                      ),
                                    )
                                  }
                                >
                                  <option value="vertical">Vertical</option>
                                  <option value="horizontal">Horizontal</option>
                                </select>
                              </div>
                              {el.type === "choice" ? (
                                <div className={styles.settingRow}>
                                  <span className={styles.settingLabel}>Selection</span>
                                  <label className={styles.settingCheckLabel}>
                                    <input
                                      type="checkbox"
                                      checked={Boolean(el.allowMultipleAnswers)}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setPages((prev) =>
                                          prev.map((p) =>
                                            p.id === page.id
                                              ? {
                                                  ...p,
                                                  elements: p.elements.map((item) =>
                                                    item.id === el.id
                                                      ? { ...item, allowMultipleAnswers: checked }
                                                      : item,
                                                  ),
                                                }
                                              : p,
                                          ),
                                        );
                                        if (!checked) {
                                          setPreviewValues((prev) => {
                                            const current = prev[el.id];
                                            if (!Array.isArray(current)) return prev;
                                            return { ...prev, [el.id]: current[0] || "" };
                                          });
                                        }
                                      }}
                                    />
                                    Allow multiple answers
                                  </label>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {shouldShowVisibilityControl(page.elements, elIndex) && hasMappedSelectorInPage(page.elements) ? (
                        <div className={styles.settingPanel}>
                          <div className={styles.settingRow}>
                            <label className={styles.settingLabel}>Visibility</label>
                            <select
                              className={styles.settingSelect}
                              value={el.displayCondition || "always"}
                              onChange={(e) =>
                                setPages((prev) =>
                                  prev.map((p) =>
                                    p.id === page.id
                                      ? {
                                          ...p,
                                          elements: p.elements.map((item) =>
                                            item.id === el.id
                                              ? { ...item, displayCondition: e.target.value as "always" | "after_mapped_selection" }
                                              : item,
                                          ),
                                        }
                                      : p,
                                  ),
                                )
                              }
                            >
                              <option value="always">Always show</option>
                              <option value="after_mapped_selection">Show after mapped app selected</option>
                            </select>
                          </div>
                        </div>
                      ) : null}

                      {el.type === "rating" ? (
                        <div className={styles.optionList}>
                          <div className={styles.optionRow}>
                            <label style={{ fontSize: "12px", color: "#374151", minWidth: "120px" }}>
                              Rating Scale
                            </label>
                            <input
                              type="number"
                              min={3}
                              max={10}
                              value={el.options[0] || "10"}
                              onChange={(e) => {
                                const next = e.target.value;
                                setPages((prev) =>
                                  prev.map((p) =>
                                    p.id === page.id
                                      ? {
                                          ...p,
                                          elements: p.elements.map((item) =>
                                            item.id === el.id
                                              ? { ...item, options: [next || "10"] }
                                              : item,
                                          ),
                                        }
                                      : p,
                                  ),
                                );
                              }}
                            />
                          </div>
                        </div>
                      ) : null}

                      {(["likert", "matrix"] as ElementType[]).includes(el.type) ? (
                        <div className={styles.optionList}>
                          {el.options.map((opt, idx) => (
                            <div key={`${el.id}-${idx}`} className={styles.optionRow}>
                              <input
                                value={opt}
                                onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.map((ov,oi)=>oi===idx?e.target.value:ov)}:item)}:p))}
                              />
                              <button
                                type="button"
                                className={styles.optionDelete}
                                onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.length>1?item.options.filter((_,oi)=>oi!==idx):item.options}:item)}:p))}
                              >
                                {"\u00D7"}
                              </button>
                            </div>
                          ))}
                          <button
                            className={styles.inlineButton}
                            type="button"
                            onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:[...item.options,el.type==="likert"?`Statement ${item.options.length+1}`:`Column ${item.options.length+1}`]}:item)}:p))}
                          >
                            + Add {el.type === "likert" ? "statement" : "column"}
                          </button>
                        </div>
                      ) : null}

                      {el.type === "text" ? (
                        <div className={styles.settingPanel}>
                          {(() => {
                            const ratingCandidates = page.elements.filter(
                              (item, idx) => idx < elIndex && (item.type === "rating" || item.type === "likert"),
                            );
                            const hasCandidates = ratingCandidates.length > 0;
                            const thresholdValue = Math.min(
                              10,
                              Math.max(1, Math.round(Number(el.conditionalRequiredThreshold || 7))),
                            );
                            const enabled = Boolean(el.conditionalRequiredSourceId);
                            const selectedSourceId = hasCandidates
                              ? (el.conditionalRequiredSourceId && ratingCandidates.some((item) => item.id === el.conditionalRequiredSourceId)
                                ? el.conditionalRequiredSourceId
                                : ratingCandidates[ratingCandidates.length - 1].id)
                              : "";

                            return (
                              <>
                                <div className={styles.settingRow}>
                                  <label className={styles.settingLabel}>Comment Rule</label>
                                  <label className={styles.settingCheckLabel}>
                                    <input
                                      type="checkbox"
                                      disabled={!hasCandidates}
                                      checked={enabled}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setPages((prev) =>
                                          prev.map((p) =>
                                            p.id === page.id
                                              ? {
                                                  ...p,
                                                  elements: p.elements.map((item) =>
                                                    item.id === el.id
                                                      ? {
                                                          ...item,
                                                          conditionalRequiredSourceId: checked ? (selectedSourceId || undefined) : undefined,
                                                          conditionalRequiredThreshold: checked ? thresholdValue : undefined,
                                                        }
                                                      : item,
                                                  ),
                                                }
                                              : p,
                                          ),
                                        );
                                      }}
                                    />
                                    <span>Wajib isi jika score di bawah threshold</span>
                                  </label>
                                </div>
                                {!hasCandidates ? (
                                  <div className={styles.settingHint}>Tambahkan elemen rating/likert di atas komentar ini agar rule bisa diaktifkan.</div>
                                ) : null}
                                {enabled && hasCandidates ? (
                                  <>
                                    <div className={styles.settingRow}>
                                      <label className={styles.settingLabel}>Score Source</label>
                                      <select
                                        className={styles.settingSelect}
                                        value={el.conditionalRequiredSourceId || selectedSourceId}
                                        onChange={(e) =>
                                          setPages((prev) =>
                                            prev.map((p) =>
                                              p.id === page.id
                                                ? {
                                                    ...p,
                                                    elements: p.elements.map((item) =>
                                                      item.id === el.id
                                                        ? {
                                                            ...item,
                                                            conditionalRequiredSourceId: e.target.value || undefined,
                                                          }
                                                        : item,
                                                    ),
                                                  }
                                                : p,
                                            ),
                                          )
                                        }
                                      >
                                        {ratingCandidates.map((item, idx) => (
                                          <option key={`${el.id}-rating-source-${item.id}`} value={item.id}>
                                            {item.title || `${item.type === "likert" ? "Likert" : "Rating"} ${idx + 1}`}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className={styles.settingRow}>
                                      <label className={styles.settingLabel}>Threshold</label>
                                      <input
                                        className={styles.settingSelect}
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={thresholdValue}
                                        onChange={(e) => {
                                          const next = Math.min(10, Math.max(1, Number(e.target.value || 7)));
                                          setPages((prev) =>
                                            prev.map((p) =>
                                              p.id === page.id
                                                ? {
                                                    ...p,
                                                    elements: p.elements.map((item) =>
                                                      item.id === el.id
                                                        ? {
                                                            ...item,
                                                            conditionalRequiredThreshold: next,
                                                          }
                                                        : item,
                                                    ),
                                                  }
                                                : p,
                                            ),
                                          );
                                        }}
                                      />
                                    </div>
                                  </>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                      ) : null}

                      <div className={styles.elementActions}>
                        <label>
                          <input
                            type="checkbox"
                            checked={el.required}
                            onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,required:e.target.checked}:item)}:p))}
                          />{" "}
                          Required
                        </label>
                        <div className={styles.elementReorder}>
                          <button
                            type="button"
                            className={styles.inlineButton}
                            disabled={elIndex === 0}
                            onClick={() => moveElementWithinPage(page.id, elIndex, "up")}
                          >
                            Move Up
                          </button>
                          <button
                            type="button"
                            className={styles.inlineButton}
                            disabled={elIndex === page.elements.length - 1}
                            onClick={() => moveElementWithinPage(page.id, elIndex, "down")}
                          >
                            Move Down
                          </button>
                        </div>
                        <button
                          className={styles.inlineButton}
                          type="button"
                          onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.filter((item)=>item.id!==el.id)}:p))}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className={styles.addElement}><select defaultValue="" onChange={(e)=>{const value=e.target.value as ElementType; if(!value)return; addElement(page.id,value); e.target.value="";}}><option value="">+ Add Element</option>{ELEMENTS.map((item)=><option key={`${page.id}-${item.type}`} value={item.type}>{item.label}</option>)}</select></div>
                </article>
              ))}

              <button className={styles.addPage} type="button" onClick={addPage}>+ Add Page</button>
              </div>
            </div>
          </main>
        </div>
      )}

      {showSchedule ? <div className={styles.overlay} onClick={()=>setShowSchedule(false)}><div className={styles.modal} onClick={(e)=>e.stopPropagation()}><div className={styles.modalHead}><h2>Schedule Settings</h2><button className={styles.inlineButton} type="button" onClick={()=>setShowSchedule(false)}>Close</button></div><div className={styles.modalBody}><label>Start Date &amp; Time<input type="datetime-local" value={scheduleStart} onChange={(e)=>setScheduleStart(e.target.value)} /></label><label>End Date &amp; Time<input type="datetime-local" value={scheduleEnd} onChange={(e)=>setScheduleEnd(e.target.value)} /></label></div></div></div> : null}

      {showStyle ? (
        <div className={styles.overlay} onClick={() => setShowStyle(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Style Settings</h2>
              <button className={styles.inlineButton} type="button" onClick={() => setShowStyle(false)}>Close</button>
            </div>
            <div className={styles.modalBody}>
              <label>
                Hero Title
                <input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="Survey hero title" />
              </label>
              <label>
                Hero Subtitle
                <input value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} placeholder="Survey hero subtitle" />
              </label>
              <label>
                Your Logo
                <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0], setLogo)} />
              </label>
              <label>
                Background Color
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </label>
              <label>
                Background Image
                <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0], setBgImage)} />
              </label>
              <label>
                Primary Color
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </label>
              <label>
                Secondary Color
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
              </label>
              <label>
                Font
                <select value={font} onChange={(e) => setFont(e.target.value as FontPreset)}>
                  <option value="default">Default</option>
                  <option value="georgia">Georgia</option>
                  <option value="trebuchet">Trebuchet MS</option>
                  <option value="verdana">Verdana</option>
                  <option value="tahoma">Tahoma</option>
                  <option value="courier">Courier New</option>
                </select>
              </label>
              <label>
                Button Style
                <select value={buttonStyle} onChange={(e) => setButtonStyle(e.target.value as "rounded" | "pill" | "square")}>
                  <option value="rounded">Rounded</option>
                  <option value="pill">Pill</option>
                  <option value="square">Square</option>
                </select>
              </label>
              <label>
                Show Progress Bar
                <select value={showProgressBar ? "yes" : "no"} onChange={(e) => setShowProgressBar(e.target.value === "yes")}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label>
                Show Page Numbers
                <select value={showPageNumbers ? "yes" : "no"} onChange={(e) => setShowPageNumbers(e.target.value === "yes")}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label>
                Multi Page
                <select value={multiPage ? "yes" : "no"} onChange={(e) => setMultiPage(e.target.value === "yes")}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {showTemplatePicker ? (
        <div className={styles.overlay} onClick={() => { setShowTemplatePicker(false); setShowTemplateConfirm(false); }}>
          <div className={`${styles.modal} ${styles.templateModal}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Choose Template</h2>
              <button className={styles.inlineButton} type="button" onClick={() => { setShowTemplatePicker(false); setShowTemplateConfirm(false); }}>
                Close
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.templateToolbar}>
                <input
                  className={styles.templateSearch}
                  placeholder="Search templates"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                />
                <div className={styles.templateCategories}>
                  {[
                    { id: "all", label: "All" },
                    { id: "feedback", label: "Feedback" },
                    { id: "employee", label: "Employee" },
                    { id: "service", label: "Service" },
                    { id: "compliance", label: "Compliance" },
                    { id: "event", label: "Event" },
                  ].map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={`${styles.templateChip} ${templateCategory === category.id ? styles.templateChipActive : ""}`}
                      onClick={() => setTemplateCategory(category.id as "all" | BuilderTemplate["category"])}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.templateGrid}>
                {filteredTemplates.length === 0 ? (
                  <div className={styles.templateEmpty}>No template matched your search/filter.</div>
                ) : (
                  filteredTemplates.map((template) => {
                    const elementCount = template.pages.reduce((sum, page) => sum + page.elements.length, 0);
                    const templateElementTypes = Array.from(
                      new Set(template.pages.flatMap((page) => page.elements.map((element) => element.type))),
                    ).slice(0, 5);
                    return (
                      <button
                        key={template.id}
                        type="button"
                        className={`${styles.templateCard} ${selectedTemplateId === template.id ? styles.templateCardActive : ""}`}
                        onClick={() => onSelectTemplate(template.id)}
                      >
                        <div className={styles.templateThumb} style={getTemplatePreviewStyle(template)}>
                          <div className={styles.templateThumbHeader}>
                            <span className={styles.templateThumbBadge}>{template.category}</span>
                          </div>
                          <div className={styles.templateThumbOverlay}>
                            <div className={styles.templateThumbTitleLine}>
                              {template.name.toLowerCase()}
                            </div>
                            <div className={styles.templateThumbSubLine}>
                              {template.description.slice(0, 44)}
                            </div>
                          </div>
                          <div className={styles.templateThumbBars}>
                            {template.pages.map((page, index) => {
                              const type = templateElementTypes[index % Math.max(templateElementTypes.length, 1)];
                              const icon = type ? elementIconMap[type] : "•";
                              return (
                              <span
                                key={`${template.id}-bar-${index + 1}`}
                                className={styles.templateThumbBar}
                                style={{ width: `${Math.max(28, Math.min(100, page.elements.length * 16))}%` }}
                              >
                                <span className={styles.templateThumbBarIcon}>{icon}</span>
                              </span>
                            )})}
                          </div>
                        </div>
                        <div className={styles.templateName}>{template.name}</div>
                        <div className={styles.templateDesc}>{template.description}</div>
                        <div className={styles.templateMeta}>
                          <span>{template.pages.length} pages</span>
                          <span>{elementCount} elements</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className={styles.templateActions}>
                <button type="button" className={styles.sideAction} onClick={() => { setShowTemplatePicker(false); setShowTemplateConfirm(false); }}>
                  Cancel
                </button>
                <button type="button" className={styles.sideActionPrimary} disabled={!selectedTemplate} onClick={onApplySelectedTemplate}>
                  Apply Template
                </button>
              </div>

              {showTemplateConfirm && selectedTemplate ? (
                <div className={styles.templateConfirmBox}>
                  <div className={styles.templateConfirmTitle}>Replace current builder content?</div>
                  <div className={styles.templateConfirmText}>
                    Current pages and elements akan diganti dengan template <strong>{selectedTemplate.name}</strong>.
                    Gunakan Save Draft setelah apply agar tersimpan ke server.
                  </div>
                  <div className={styles.templateConfirmActions}>
                    <button type="button" className={styles.sideAction} onClick={() => setShowTemplateConfirm(false)}>
                      Back
                    </button>
                    <button type="button" className={styles.sideActionPrimary} onClick={() => applyTemplate(selectedTemplate)}>
                      Yes, Replace
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}

































































