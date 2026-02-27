"use client";

/* eslint-disable react-hooks/set-state-in-effect */

/* eslint-disable @next/next/no-img-element */

import { fetchSurveyById, updateEventById, updateEventConfiguration, fetchSurveyQuestions, createSurveyQuestion, updateSurveyQuestion, deleteSurveyQuestion } from "@/lib/surveys";
import { fetchOrgHierarchy, type BusinessUnitOption, type DivisionOption, type DepartmentOption } from "@/lib/org-hierarchy";
import { fetchFunctionsMaster, type FunctionMaster } from "@/lib/master-data";
import { fetchMappedApplicationsByDepartment, fetchMappedApplicationsByFunction } from "@/lib/mappings";
import type { SurveyQuestion } from "@/types/survey";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
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
  displayCondition?: "always" | "after_mapped_selection";
  conditionalRequiredSourceId?: string;
  conditionalRequiredThreshold?: number;
}

interface BuilderPage {
  id: number;
  title: string;
  elements: BuilderElement[];
}

interface DraftPayload {
  surveyTitle: string;
  surveyDesc: string;
  targetRespondents: string;
  targetScore: string;
  scheduleStart: string;
  scheduleEnd: string;
  pages: BuilderPage[];
  style: { logo: string; backgroundColor: string; backgroundImage: string; font: FontPreset };
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

function toDateInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
      coverUrl: "",
      dataSource: parseDataSource(q.Options),
      optionLayout: parseOptionLayout(q.Options, resolvedType),
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

  const [showSchedule, setShowSchedule] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
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
      setSurveyDesc(detail.Description || "");
      setTargetRespondents(detail.TargetRespondents != null ? String(detail.TargetRespondents) : "");
      setTargetScore(detail.TargetScore != null ? String(detail.TargetScore) : "");
      setScheduleStart(toDateInput(detail.StartDate));
      setScheduleEnd(toDateInput(detail.EndDate));
      setBgColor(detail.configuration?.BackgroundColor || "#f5f5f5");
      setBgImage(detail.configuration?.BackgroundImageUrl || "");
      setLogo(detail.configuration?.LogoUrl || "");

      const local = localStorage.getItem(draftKey);
      if (local) {
        try {
          const draft = JSON.parse(local) as DraftPayload;
          setSurveyTitle(draft.surveyTitle || detail.Title || "");
          setSurveyDesc(draft.surveyDesc || detail.Description || "");
          setTargetRespondents(draft.targetRespondents || "");
          setTargetScore(draft.targetScore || "");
          setScheduleStart(draft.scheduleStart || toDateInput(detail.StartDate));
          setScheduleEnd(draft.scheduleEnd || toDateInput(detail.EndDate));
          const draftPages = ensureUniqueElementIds(Array.isArray(draft.pages) ? draft.pages : []);
          setPages(draftPages);
          setElementCounter(getMaxTempElementCounter(draftPages));
          setLogo(draft.style?.logo || "");
          setBgColor(draft.style?.backgroundColor || "#f5f5f5");
          setBgImage(draft.style?.backgroundImage || "");
          setFont(draft.style?.font || "default");
          return;
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
    return `Period: ${scheduleStart} - ${scheduleEnd}`;
  }, [scheduleEnd, scheduleStart]);

  const styleSummary = useMemo(() => `Logo: ${logo ? "On" : "Off"} | Background: ${bgColor} | Font: ${font === "default" ? "Default" : font}`, [bgColor, font, logo]);

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

  const validateEventSchedule = (): boolean => {
    if (scheduleStart && scheduleEnd && scheduleStart > scheduleEnd) {
      setError("Tanggal akhir harus sama atau setelah tanggal mulai");
      return false;
    }

    return true;
  };

  const isQuestionImmutableError = (message: string): boolean => {
    const value = message.toLowerCase();
    return value.includes("has responses") || value.includes("cannot modify question");
  };
  const syncQuestionsToServer = async (): Promise<boolean> => {
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

    const flat: Array<{ pageNumber: number; displayOrder: number; element: BuilderElement }> = [];
    let order = 1;
    pages.forEach((page, pageIndex) => {
      page.elements.forEach((element) => {
        flat.push({ pageNumber: pageIndex + 1, displayOrder: order, element });
        order += 1;
      });
    });

    for (const item of flat) {
      const questionId = extractQuestionId(item.element.id);
      const ratingScale = Number(item.element.options?.[0] || 10);
      const resolvedRatingScale = Number.isFinite(ratingScale)
        ? Math.min(10, Math.max(3, Math.round(ratingScale)))
        : 10;
      const payload = {
        surveyId,
        type: toApiType(item.element.type),
        promptText: item.element.title || "Untitled Question",
        subtitle: item.element.subtitle || null,
        imageUrl: item.element.type === "hero" ? item.element.coverUrl || null : null,
        isMandatory: item.element.required,
        displayOrder: item.displayOrder,
        pageNumber: item.pageNumber,
        layoutOrientation: "vertical" as const,
        options: (() => {
          const displayCondition =
            item.element.displayCondition && item.element.displayCondition !== "always"
              ? { displayCondition: item.element.displayCondition }
              : {};
          const conditionalRequired =
            item.element.conditionalRequiredSourceId
              ? {
                  conditionalRequired: {
                    sourceElementId: item.element.conditionalRequiredSourceId,
                    threshold: Math.min(
                      10,
                      Math.max(1, Math.round(Number(item.element.conditionalRequiredThreshold || 7))),
                    ),
                  },
                }
              : {};

          if (["choice", "checkbox", "dropdown"].includes(item.element.type)) {
            return {
              options: item.element.options,
              dataSource: item.element.dataSource || "manual",
              ...(item.element.type === "choice" || item.element.type === "checkbox"
                ? { layout: item.element.optionLayout || "vertical" }
                : {}),
              ...displayCondition,
              ...conditionalRequired,
            };
          }
          if (item.element.type === "likert") return { variant: "likert", rows: item.element.options, ...displayCondition, ...conditionalRequired };
          if (item.element.type === "matrix") return { variant: "matrix", columns: item.element.options, ...displayCondition, ...conditionalRequired };
          if (item.element.type === "rating") return { ratingScale: resolvedRatingScale, ...displayCondition, ...conditionalRequired };
          if (Object.keys(displayCondition).length > 0 || Object.keys(conditionalRequired).length > 0) {
            return { ...displayCondition, ...conditionalRequired };
          }
          return null;
        })(),
      };

      if (questionId && remoteById.has(questionId)) {
        const updated = await updateSurveyQuestion(questionId, {
          ...payload,
          updatedBy: currentUserId,
        });
        if (!updated.success) {
          if (isQuestionImmutableError(updated.message || "")) {
            setMessage("Survey sudah memiliki respons. Perubahan pertanyaan tidak dapat disimpan, hanya pengaturan event yang diperbarui.");
            return true;
          }

          setError(updated.message || "Gagal memperbarui pertanyaan");
          return false;
        }
        keptIds.add(questionId);
      } else {
        const created = await createSurveyQuestion({
          ...payload,
          createdBy: currentUserId,
        });
        if (!created.success || !created.question) {
          if (isQuestionImmutableError(created.message || "")) {
            setMessage("Survey sudah memiliki respons. Perubahan pertanyaan tidak dapat disimpan, hanya pengaturan event yang diperbarui.");
            return true;
          }

          setError(created.message || "Gagal menambah pertanyaan");
          return false;
        }
        keptIds.add(created.question.QuestionId);
        idRemap.set(item.element.id, `q-${created.question.QuestionId}`);
      }
    }

    const deleteWarnings: string[] = [];
    for (const question of remote.questions) {
      if (keptIds.has(question.QuestionId)) continue;
      const removed = await deleteSurveyQuestion(question.QuestionId);
      if (!removed.success) {
        const message = (removed.message || "").toLowerCase();
        if (isQuestionImmutableError(message)) {
          deleteWarnings.push("Beberapa pertanyaan tidak bisa dihapus karena survey sudah memiliki respons.");
          continue;
        }

        setError(removed.message || "Gagal menghapus pertanyaan yang sudah dihapus dari builder");
        return false;
      }
    }

    if (deleteWarnings.length > 0) {
      setMessage(deleteWarnings[0]);
    }

    if (idRemap.size > 0) {
      setPages((prev) =>
        prev.map((page) => ({
          ...page,
          elements: page.elements.map((element) => ({
            ...element,
            id: idRemap.get(element.id) || element.id,
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
      surveyDesc,
      targetRespondents,
      targetScore,
      scheduleStart,
      scheduleEnd,
      pages,
      style: { logo, backgroundColor: bgColor, backgroundImage: bgImage, font },
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
      description: surveyDesc,
      status: "Draft",
      targetRespondents: Number.isFinite(parsedTargetRespondents)
        ? parsedTargetRespondents
        : undefined,
      targetScore: Number.isFinite(parsedTargetScore) ? parsedTargetScore : undefined,
    };
    if (scheduleStart) {
      updatePayload.startDate = new Date(`${scheduleStart}T00:00:00`).toISOString();
    }
    if (scheduleEnd) {
      updatePayload.endDate = new Date(`${scheduleEnd}T00:00:00`).toISOString();
    }

    setSaving(true);
    const update = await updateEventById(surveyId, updatePayload);
    setSaving(false);

    if (!update.success) {
      setError(update.message || "Draft lokal tersimpan, sinkron server gagal");
      return;
    }

    const configUpdate = await updateEventConfiguration(surveyId, {
      LogoUrl: logo || null,
      BackgroundColor: bgColor || null,
      BackgroundImageUrl: bgImage || null,
      FontFamily: font === "default" ? null : font,
    });
    if (!configUpdate.success) {
      setMessage("Draft tersimpan, tetapi style belum tersimpan ke server.");
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
      description: surveyDesc,
      status: "Active",
      targetRespondents: Number.isFinite(parsedTargetRespondents)
        ? parsedTargetRespondents
        : undefined,
      targetScore: Number.isFinite(parsedTargetScore) ? parsedTargetScore : undefined,
    };
    if (scheduleStart) {
      updatePayload.startDate = new Date(`${scheduleStart}T00:00:00`).toISOString();
    }
    if (scheduleEnd) {
      updatePayload.endDate = new Date(`${scheduleEnd}T00:00:00`).toISOString();
    }

    const update = await updateEventById(surveyId, updatePayload);
    setPublishing(false);

    if (!update.success) {
      setError(update.message || "Gagal publish");
      return;
    }

    const configUpdate = await updateEventConfiguration(surveyId, {
      LogoUrl: logo || null,
      BackgroundColor: bgColor || null,
      BackgroundImageUrl: bgImage || null,
      FontFamily: font === "default" ? null : font,
    });
    if (!configUpdate.success) {
      setError(configUpdate.message || "Publish berhasil, namun style belum tersimpan.");
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
    const sourceValue = Number(values[element.conditionalRequiredSourceId] || 0);
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
                                {effectiveElement.type !== "hero" ? <div className={styles.previewLabel}>{effectiveElement.title || "Question"}{effectiveElement.required ? " *" : ""}</div> : null}
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
                                {effectiveElement.type !== "hero" ? <div className={styles.previewLabel}>{effectiveElement.title || "Question"}{effectiveElement.required ? " *" : ""}</div> : null}
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
              <button className={styles.sideAction} type="button" onClick={() => setMessage("Load Template: WIP")}>Load Template</button>
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
                <div><div className={styles.brandLabel}>Style Preview</div><div className={styles.brandText}>{styleSummary}</div></div>
              </div>

              <div className={styles.surveyCard}>
                <input className={styles.surveyTitle} placeholder="Survey Title" value={surveyTitle} onChange={(e)=>setSurveyTitle(e.target.value)} />
                <input className={styles.surveyDesc} placeholder="Survey description" value={surveyDesc} onChange={(e)=>setSurveyDesc(e.target.value)} />
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
                              (item, idx) => idx < elIndex && item.type === "rating",
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
                                    <span>Wajib isi jika rating di bawah threshold</span>
                                  </label>
                                </div>
                                {!hasCandidates ? (
                                  <div className={styles.settingHint}>Tambahkan elemen rating di atas komentar ini agar rule bisa diaktifkan.</div>
                                ) : null}
                                {enabled && hasCandidates ? (
                                  <>
                                    <div className={styles.settingRow}>
                                      <label className={styles.settingLabel}>Rating Source</label>
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
                                            {item.title || `Rating ${idx + 1}`}
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

                      <div className={styles.elementActions}><label><input type="checkbox" checked={el.required} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,required:e.target.checked}:item)}:p))} /> Required</label><button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.filter((item)=>item.id!==el.id)}:p))}>Delete</button></div>
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

      {showSchedule ? <div className={styles.overlay} onClick={()=>setShowSchedule(false)}><div className={styles.modal} onClick={(e)=>e.stopPropagation()}><div className={styles.modalHead}><h2>Schedule Settings</h2><button className={styles.inlineButton} type="button" onClick={()=>setShowSchedule(false)}>Close</button></div><div className={styles.modalBody}><label>Start Date<input type="date" value={scheduleStart} onChange={(e)=>setScheduleStart(e.target.value)} /></label><label>End Date<input type="date" value={scheduleEnd} onChange={(e)=>setScheduleEnd(e.target.value)} /></label></div></div></div> : null}

      {showStyle ? <div className={styles.overlay} onClick={()=>setShowStyle(false)}><div className={styles.modal} onClick={(e)=>e.stopPropagation()}><div className={styles.modalHead}><h2>Style Settings</h2><button className={styles.inlineButton} type="button" onClick={()=>setShowStyle(false)}>Close</button></div><div className={styles.modalBody}><label>Your Logo<input type="file" accept="image/*" onChange={(e)=>onFile(e.target.files?.[0],setLogo)} /></label><label>Background Color<input type="color" value={bgColor} onChange={(e)=>setBgColor(e.target.value)} /></label><label>Background Image<input type="file" accept="image/*" onChange={(e)=>onFile(e.target.files?.[0],setBgImage)} /></label><label>Font<select value={font} onChange={(e)=>setFont(e.target.value as FontPreset)}><option value="default">Default</option><option value="georgia">Georgia</option><option value="trebuchet">Trebuchet MS</option><option value="verdana">Verdana</option><option value="tahoma">Tahoma</option><option value="courier">Courier New</option></select></label></div></div></div> : null}

    </section>
  );
}

































































