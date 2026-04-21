"use client";

/* eslint-disable @next/next/no-img-element */

import SurveyPreviewElement, { type PreviewElement } from "@/components/survey/survey-preview-element";
import type { FunctionMaster } from "@/lib/master-data";
import type { BusinessUnitOption, DepartmentOption, DivisionOption } from "@/lib/org-hierarchy";
import {
  checkDuplicatePublicResponse,
  fetchPublicApplications,
  fetchPublicMasterData,
  fetchPublicSurveyForm,
  submitPublicSurveyResponse,
  type PublicQuestion,
  type PublicSurveyForm,
} from "@/lib/public-survey";
import { resolveEventStatus } from "@/lib/event-status";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./survey-public.module.css";

type PageGroup = {
  pageNumber: number;
  title: string;
  questions: PublicQuestion[];
};

type ApplicationSelection = {
  id: string;
  name: string;
};

type RenderedQuestion = {
  element: PreviewElement;
  sourceQuestion: PublicQuestion;
  applicationName?: string;
  baseQuestionId: string;
};

type MasterDataState = {
  businessUnits: BusinessUnitOption[];
  divisions: DivisionOption[];
  departments: DepartmentOption[];
  functions: FunctionMaster[];
};

function normalizeQuestionType(question: PublicQuestion): PreviewElement["type"] {
  if (question.type === "HeroCover") return "hero";
  if (question.type === "Text") return "text";
  if (question.type === "MultipleChoice") return "choice";
  if (question.type === "Checkbox") return "checkbox";
  if (question.type === "Dropdown") return "dropdown";
  if (question.type === "Rating") return "rating";
  if (question.type === "Date") return "date";
  if (question.type === "Signature") return "signature";
  if (question.type === "MatrixLikert") {
    if (String((question.options || {}).variant || "").toLowerCase() === "matrix") {
      return "matrix";
    }
    return "likert";
  }
  return "text";
}

function normalizeQuestion(question: PublicQuestion): PreviewElement {
  const options = question.options || {};
  const conditionalRequired = (options.conditionalRequired || {}) as {
    sourceElementId?: unknown;
    threshold?: unknown;
  };
  const type = normalizeQuestionType(question);

  // Untuk rating: simpan ratingScale di options[0] agar preview bisa baca skala yang benar
  if (type === "rating") {
    const scale = Number(options.ratingScale ?? options.scale ?? 10);
    const clampedScale = Number.isFinite(scale) ? Math.min(10, Math.max(1, Math.round(scale))) : 10;
    return {
      id: question.questionId,
      type,
      title: question.promptText || "",
      subtitle: question.subtitle || "",
      required: Boolean(question.isMandatory),
      options: [String(clampedScale)],
      coverUrl: "",
      dataSource: typeof options.dataSource === "string" ? (options.dataSource as PreviewElement["dataSource"]) : undefined,
      optionLayout: "vertical",
      allowMultipleAnswers: false,
      displayCondition: options.displayCondition === "after_mapped_selection" ? "after_mapped_selection" : "always",
      conditionalRequiredSourceId: typeof conditionalRequired.sourceElementId === "string"
        ? String(conditionalRequired.sourceElementId)
        : undefined,
      conditionalRequiredThreshold: Number.isFinite(Number(conditionalRequired.threshold))
        ? Number(conditionalRequired.threshold)
        : undefined,
    };
  }

  const optionSource = Array.isArray(options.options)
    ? options.options
    : type === "likert"
      ? Array.isArray(options.rows) ? options.rows : []
      : type === "matrix"
        ? Array.isArray(options.columns) ? options.columns : []
        : [];

  // Untuk likert: append skala sebagai elemen terakhir jika berupa angka bulat
  // Convention yang dibaca oleh survey-preview-element: options terakhir = skala jika angka bulat
  const resolvedOptions: string[] = type === "likert"
    ? (() => {
        const rows = optionSource.map((item) => String(item));
        const scale = Number(options.ratingScale ?? options.scale ?? 10);
        const clampedScale = Number.isFinite(scale) && scale >= 1 ? Math.min(10, Math.round(scale)) : 10;
        return [...rows, String(clampedScale)];
      })()
    : optionSource.map((item) => String(item));

  return {
    id: question.questionId,
    type,
    title: question.promptText || "",
    subtitle: question.subtitle || "",
    required: Boolean(question.isMandatory),
    options: resolvedOptions,
    coverUrl: type === "hero" ? String(question.imageUrl || options.heroImageUrl || "") : "",
    dataSource: typeof options.dataSource === "string" ? (options.dataSource as PreviewElement["dataSource"]) : undefined,
    optionLayout: options.layout === "horizontal" ? "horizontal" : "vertical",
    allowMultipleAnswers: Boolean(options.allowMultipleAnswers),
    displayCondition: options.displayCondition === "after_mapped_selection" ? "after_mapped_selection" : "always",
    conditionalRequiredSourceId: typeof conditionalRequired.sourceElementId === "string"
      ? String(conditionalRequired.sourceElementId)
      : undefined,
    conditionalRequiredThreshold: (() => {
      // Untuk likert: baca commentThreshold dari options
      if (type === "likert" && Number.isFinite(Number(options.commentThreshold))) {
        return Number(options.commentThreshold);
      }
      return Number.isFinite(Number(conditionalRequired.threshold))
        ? Number(conditionalRequired.threshold)
        : undefined;
    })(),
    likertEnableComment: type === "likert"
      ? (options.enableComment === false ? false : true)
      : undefined,
  };
}

function getPageGroups(form: PublicSurveyForm | null): PageGroup[] {
  if (!form) return [];
  const pageMap = new Map<number, PublicQuestion[]>();
  form.questions.forEach((question) => {
    const pageNumber = Number(question.pageNumber || 1);
    const list = pageMap.get(pageNumber) || [];
    list.push(question);
    pageMap.set(pageNumber, list);
  });
  return [...pageMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, questions]) => ({
      pageNumber,
      title: `Page ${pageNumber}`,
      questions: [...questions].sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0)),
    }));
}

function getRenderedPageGroups(form: PublicSurveyForm | null): PageGroup[] {
  const groups = getPageGroups(form);
  if (!form) return [];
  if (form.configuration?.multiPage === false) {
    return [{
      pageNumber: 1,
      title: form.title || "Survey Form",
      // Filter out HeroCover — sudah ditampilkan di layout header
      questions: groups.flatMap((group) => group.questions).filter((q) => q.type !== "HeroCover"),
    }];
  }

  // Untuk multi-page:
  // - Page yang HANYA berisi HeroCover → tetap tampil sebagai welcome page (questions kosong)
  // - Page yang berisi HeroCover + question lain → filter HeroCover, tampilkan sisanya
  // - Page yang tidak berisi HeroCover → tampil normal
  const processedGroups = groups.map((group) => {
    const hasOnlyHeroCover =
      group.questions.length > 0 &&
      group.questions.every((q) => q.type === "HeroCover");

    if (hasOnlyHeroCover) {
      // Welcome page — kosongkan questions, hero image sudah di layout header
      return { ...group, questions: [] };
    }

    // Filter HeroCover dari page yang punya question lain
    return {
      ...group,
      questions: group.questions.filter((q) => q.type !== "HeroCover"),
    };
  });

  // Hapus page yang jadi kosong KECUALI welcome page (page pertama yang memang kosong)
  return processedGroups.filter((group, index) => {
    if (group.questions.length > 0) return true;
    // Pertahankan page kosong hanya jika itu adalah page pertama (welcome)
    return index === 0;
  });
}

function buildRenderedQuestionsForPage(page: PageGroup | null, values: Record<string, unknown>): RenderedQuestion[] {
  if (!page) return [];

  const normalizedElements = page.questions.map(normalizeQuestion);
  const mappedSelectorIndex = normalizedElements.findIndex(
    (item) =>
      (item.type === "choice" || item.type === "checkbox" || item.type === "dropdown") &&
      (item.dataSource === "app_department" || item.dataSource === "app_function"),
  );
  const mappedSelector = mappedSelectorIndex >= 0 ? normalizedElements[mappedSelectorIndex] : null;
  const selectedMappedApps = getMappedSelectionValues(mappedSelector, values);
  const beforeSelector = mappedSelectorIndex >= 0 ? normalizedElements.slice(0, mappedSelectorIndex + 1) : normalizedElements;
  const afterSelector = mappedSelectorIndex >= 0 ? normalizedElements.slice(mappedSelectorIndex + 1) : [];
  const repeatableAfterSelector = afterSelector.filter((item) => item.displayCondition === "after_mapped_selection");
  const alwaysVisibleAfterSelector = afterSelector.filter((item) => item.displayCondition !== "after_mapped_selection");
  const questionMap = new Map(page.questions.map((question) => [question.questionId, question]));

  const baseQuestions = [...beforeSelector, ...alwaysVisibleAfterSelector].map((element) => ({
    element,
    sourceQuestion: questionMap.get(element.id) as PublicQuestion,
    baseQuestionId: element.id,
  }));

  if (!mappedSelector || repeatableAfterSelector.length === 0 || !hasSelectedValue(values[mappedSelector.id])) {
    return baseQuestions;
  }

  const repeatedQuestions = selectedMappedApps.flatMap((appName) => {
    // Buat map: baseId likert → contextId per app ini, untuk auto-link komentar
    const likertContextIdByBaseId = new Map<string, string>();
    repeatableAfterSelector.forEach((el) => {
      if (el.type === "likert" || el.type === "rating") {
        likertContextIdByBaseId.set(el.id, toContextElementId(el.id, appName));
      }
    });

    return repeatableAfterSelector.map((element) => {
      // Auto-resolve conditionalRequiredSourceId ke likert/rating di app yang sama
      const resolvedSourceId = element.conditionalRequiredSourceId
        ? toContextElementId(element.conditionalRequiredSourceId, appName)
        : element.type === "text"
          ? (() => {
              // Cari likert/rating terdekat sebelum element ini
              const idx = repeatableAfterSelector.indexOf(element);
              for (let i = idx - 1; i >= 0; i--) {
                const prev = repeatableAfterSelector[i];
                if (prev.type === "likert" || prev.type === "rating") {
                  return toContextElementId(prev.id, appName);
                }
              }
              return undefined;
            })()
          : undefined;

      return {
        element: {
          ...element,
          id: toContextElementId(element.id, appName),
          title: element.type === "text"
            ? element.title  // komentar tidak perlu label app, sudah ada appGroupLabel
            : `${element.title || "Question"} (${appName})`,
          conditionalRequiredSourceId: resolvedSourceId,
          // Pastikan threshold terset untuk komentar
          conditionalRequiredThreshold: element.conditionalRequiredThreshold ?? 7,
        },
        sourceQuestion: questionMap.get(element.id) as PublicQuestion,
        applicationName: appName,
        baseQuestionId: element.id,
      };
    });
  });

  return [...baseQuestions, ...repeatedQuestions];
}

function getStorageIdentityKey(surveyId: string): string {
  return `csi.respondent.${surveyId}`;
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function getOrCreateRespondentLocalId(surveyId: string): string {
  const storageKey = getStorageIdentityKey(surveyId);
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing && /^[a-z0-9-]{6,64}$/i.test(existing)) {
      return existing.toLowerCase();
    }
  } catch {}

  const randomId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().replace(/[^a-z0-9-]/gi, "").toLowerCase()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const localId = `respondent-${randomId}`.slice(0, 64);

  try {
    localStorage.setItem(storageKey, localId);
  } catch {}

  return localId;
}

function getInitialRespondent(surveyId: string, searchParams: URLSearchParams) {
  const name = String(searchParams.get("respondentName") || searchParams.get("name") || "").trim().slice(0, 200);
  const email = normalizeEmail(String(searchParams.get("respondentEmail") || searchParams.get("email") || ""));
  getOrCreateRespondentLocalId(surveyId);
  return {
    name: name || "",
    email,
  };
}

function hasSelectedValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return false;
}

function getMappedSelectionValues(selector: PreviewElement | null, values: Record<string, unknown>): string[] {
  if (!selector) return [];
  const raw = values[selector.id];
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.map((item) => String(item || "").trim()).filter(Boolean)));
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

function toContextElementId(baseId: string, appName: string): string {
  const safe = encodeURIComponent(appName.trim().toLowerCase());
  return `${baseId}__app__${safe || "selected"}`;
}

function isConditionallyRequired(element: PreviewElement, values: Record<string, unknown>): boolean {
  if (!element.conditionalRequiredSourceId) return false;
  const threshold = Math.max(1, Math.round(Number(element.conditionalRequiredThreshold || 7)));
  const sourceValue = values[element.conditionalRequiredSourceId];
  const numericValue = Number(sourceValue);
  if (Number.isFinite(numericValue) && numericValue > 0 && numericValue < threshold) {
    return true;
  }

  if (typeof sourceValue === "object" && sourceValue && !Array.isArray(sourceValue)) {
    const scores = Object.values(sourceValue as Record<string, unknown>)
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0);
    if (scores.length > 0) {
      const avg = scores.reduce((sum, item) => sum + item, 0) / scores.length;
      return avg < threshold;
    }
  }

  return false;
}

function buildResponseValue(element: PreviewElement, values: Record<string, unknown>, commentValues: Record<string, string>) {
  if (element.type === "text" || element.type === "dropdown" || element.type === "signature") {
    return { textValue: String(values[element.id] || "").trim() || null };
  }

  if (element.type === "choice" || element.type === "checkbox") {
    const value = values[element.id];
    if (Array.isArray(value)) {
      return { textValue: value.join(", ") || null };
    }
    return { textValue: String(value || "").trim() || null };
  }

  if (element.type === "rating") {
    const numericValue = Number(values[element.id] || 0);
    return {
      numericValue: Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null,
      commentValue: commentValues[element.id]?.trim() || null,
    };
  }

  if (element.type === "date") {
    return { dateValue: String(values[element.id] || "").trim() || null };
  }

  if (element.type === "likert") {
    const rawOptions = element.options;
    const lastItem = rawOptions[rawOptions.length - 1];
    const lastAsNum = Number(lastItem);
    const hasScaleAtEnd = rawOptions.length > 0 && Number.isFinite(lastAsNum) && lastAsNum >= 1 && lastAsNum <= 10 && String(Math.round(lastAsNum)) === String(lastItem);
    const rows = hasScaleAtEnd ? rawOptions.slice(0, -1) : rawOptions;

    const matrixValues = Object.fromEntries(
      rows.map((_, rowIdx) => {
        const key = `${element.id}-${rowIdx}`;
        return [rowIdx, Number(values[key] || 0)];
      }).filter(([, value]) => Number.isFinite(value) && value > 0),
    );

    // Kumpulkan komentar per row — hanya jika enableComment aktif
    const rowComments: Record<number, string> = {};
    if (element.likertEnableComment !== false) {
      rows.forEach((_, rowIdx) => {
        const commentKey = `${element.id}-comment-${rowIdx}`;
        const comment = String(values[commentKey] || "").trim();
        if (comment) rowComments[rowIdx] = comment;
      });
    }

    return {
      matrixValues: Object.keys(matrixValues).length > 0 ? matrixValues : null,
      commentValue: Object.keys(rowComments).length > 0 ? JSON.stringify(rowComments) : null,
    };
  }

  if (element.type === "matrix") {
    const matrixValues = Object.fromEntries(
      ["0", "1", "2", "3"].map((_, rowIdx) => {
        const key = `${element.id}-m-${rowIdx}`;
        return [rowIdx, Number(values[key] || 0) + 1];
      }).filter(([, value]) => Number.isFinite(value) && value > 0),
    );
    return { matrixValues: Object.keys(matrixValues).length > 0 ? matrixValues : null };
  }

  return { textValue: null };
}

export default function SurveyClient({ surveyId }: { surveyId: string }) {
  const [form, setForm] = useState<PublicSurveyForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [commentValues, setCommentValues] = useState<Record<string, string>>({});
  const [masterData, setMasterData] = useState<MasterDataState>({
    businessUnits: [],
    divisions: [],
    departments: [],
    functions: [],
  });
  const [mappedApplicationsByDepartment, setMappedApplicationsByDepartment] = useState<string[]>([]);
  const [mappedApplicationsByFunction, setMappedApplicationsByFunction] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const run = async () => {
      const [formResult, masterResult] = await Promise.all([
        fetchPublicSurveyForm(surveyId),
        fetchPublicMasterData(),
      ]);
      setLoading(false);

      if (!formResult.success || !formResult.form) {
        setError(formResult.message || "Survey tidak ditemukan atau sudah tidak aktif");
        return;
      }

      setForm(formResult.form);
      if (masterResult.success) {
        setMasterData({
          businessUnits: masterResult.data.businessUnits.map((item) => ({
            BusinessUnitId: item.id,
            Name: item.name,
            IsActive: true,
          })),
          divisions: masterResult.data.divisions.map((item) => ({
            DivisionId: item.id,
            BusinessUnitId: item.parentId || "",
            Name: item.name,
            IsActive: true,
          })),
          departments: masterResult.data.departments.map((item) => ({
            DepartmentId: item.id,
            DivisionId: item.parentId || "",
            Name: item.name,
            IsActive: true,
          })),
          functions: masterResult.data.functions.map((item) => ({
            FunctionId: item.id,
            Code: 0,
            Name: item.name,
            IsActive: true,
          })),
        });
      }
    };

    void run();
  }, [surveyId]);

  const pageGroups = useMemo(() => getRenderedPageGroups(form), [form]);
  const currentPage = pageGroups[currentPageIndex] || null;
  const allElements = useMemo(
    () => pageGroups.flatMap((page) => page.questions.map(normalizeQuestion)),
    [pageGroups],
  );

  useEffect(() => {
    const departmentElement = allElements.find((item) => item.dataSource === "department");
    const functionElement = allElements.find((item) => item.dataSource === "function");
    const departmentId = departmentElement ? String(values[departmentElement.id] || "") : "";
    const functionId = functionElement ? String(values[functionElement.id] || "") : "";

    const run = async () => {
      if (departmentId) {
        const result = await fetchPublicApplications(surveyId, { departmentId });
        setMappedApplicationsByDepartment(result.success ? result.applications.map((item) => item.name) : []);
      } else {
        setMappedApplicationsByDepartment([]);
      }

      if (functionId) {
        const result = await fetchPublicApplications(surveyId, { functionId });
        setMappedApplicationsByFunction(result.success ? result.applications.map((item) => item.name) : []);
      } else {
        setMappedApplicationsByFunction([]);
      }
    };

    void run();
  }, [allElements, surveyId, values]);

  const progressPercent = pageGroups.length === 0 ? 0 : ((currentPageIndex + 1) / pageGroups.length) * 100;
  const effectiveStatus = form ? resolveEventStatus({ Status: form.status, StartDate: form.startDate || "", EndDate: form.endDate || "" }) : "-";
  const showProgress = form?.configuration?.showProgressBar !== false && pageGroups.length > 1;
  const showPageNumbers = form?.configuration?.showPageNumbers !== false && pageGroups.length > 1;
  // Welcome page = page pertama yang kosong (hanya HeroCover)
  const isWelcomePage = currentPage !== null && currentPage.questions.length === 0;
  
  // Hero title/subtitle — prioritas: config > form title/desc
  const heroTitle = form?.configuration?.heroTitle || form?.title || "Survey";
  const heroSubtitle = form?.configuration?.heroSubtitle || form?.description || "";
  
  // Hero image — prioritas: config.heroImageUrl > config.logoUrl > question HeroCover imageUrl
  const heroCoverQuestion = form?.questions.find((q) => q.type === "HeroCover");
  const heroImageUrl = form?.configuration?.heroImageUrl || form?.configuration?.logoUrl || heroCoverQuestion?.imageUrl || "";
  
  const primaryColor = form?.configuration?.primaryColor || "#125ba1";
  const secondaryColor = form?.configuration?.secondaryColor || "#2c8dd8";
  const buttonStyle = form?.configuration?.buttonStyle || "rounded";

  const renderedQuestions = useMemo<RenderedQuestion[]>(() => {
    return buildRenderedQuestionsForPage(currentPage, values);
  }, [currentPage, values]);
  const allRenderedQuestions = useMemo(
    () => pageGroups.flatMap((page) => buildRenderedQuestionsForPage(page, values)),
    [pageGroups, values],
  );

  const toggleCheckbox = (id: string, option: string) => {
    setValues((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const next = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
      return { ...prev, [id]: next };
    });
  };

  const validateCurrentPage = (): boolean => {
    const nextErrors: Record<string, string> = {};
    renderedQuestions.forEach(({ element }) => {
      const required = element.required || isConditionallyRequired(element, values);
      if (!required || element.type === "hero") return;
      const responseValue = buildResponseValue(element, values, commentValues);
      const hasValue =
        responseValue.textValue ||
        responseValue.dateValue ||
        responseValue.numericValue ||
        (responseValue.matrixValues && Object.keys(responseValue.matrixValues).length > 0);
      if (!hasValue) {
        nextErrors[element.id] = "Field ini wajib diisi.";
      }

      // Validasi komentar per row untuk likert — hanya jika enableComment aktif
      if (element.type === "likert" && element.likertEnableComment !== false) {
        const rawOptions = element.options;
        const lastItem = rawOptions[rawOptions.length - 1];
        const lastAsNum = Number(lastItem);
        const hasScaleAtEnd = rawOptions.length > 0 && Number.isFinite(lastAsNum) && lastAsNum >= 1 && lastAsNum <= 10 && String(Math.round(lastAsNum)) === String(lastItem);
        const rows = hasScaleAtEnd ? rawOptions.slice(0, -1) : rawOptions;
        const commentThreshold = Math.max(1, Math.round(Number(element.conditionalRequiredThreshold || 7)));

        rows.forEach((_, rowIdx) => {
          const rowKey = `${element.id}-${rowIdx}`;
          const commentKey = `${element.id}-comment-${rowIdx}`;
          const selectedVal = Number(values[rowKey] || 0);
          if (selectedVal > 0 && selectedVal < commentThreshold) {
            const comment = String(values[commentKey] || "").trim();
            if (!comment) {
              nextErrors[commentKey] = `Komentar wajib diisi jika nilai < ${commentThreshold}.`;
            }
          }
        });
      }
    });
    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resolveSelectedApplications = async (): Promise<ApplicationSelection[]> => {
    const appElements = allElements.filter((item) => item.dataSource === "app_department" || item.dataSource === "app_function");
    const selectedNames = appElements.flatMap((element) => {
      const value = values[element.id];
      if (Array.isArray(value)) return value.map((item) => String(item));
      return String(value || "").trim() ? [String(value)] : [];
    });

    const selectedSet = new Set(selectedNames.map((item) => item.trim().toLowerCase()).filter(Boolean));
    if (selectedSet.size === 0) {
      const fallback = await fetchPublicApplications(surveyId);
      return fallback.success ? fallback.applications.slice(0, 1) : [];
    }

    const [allApps, deptApps, fnApps] = await Promise.all([
      fetchPublicApplications(surveyId),
      mappedApplicationsByDepartment.length > 0 ? fetchPublicApplications(surveyId, {
        departmentId: String(values[allElements.find((item) => item.dataSource === "department")?.id || ""] || ""),
      }) : Promise.resolve({ success: true, applications: [] as Array<{ id: string; name: string }> }),
      mappedApplicationsByFunction.length > 0 ? fetchPublicApplications(surveyId, {
        functionId: String(values[allElements.find((item) => item.dataSource === "function")?.id || ""] || ""),
      }) : Promise.resolve({ success: true, applications: [] as Array<{ id: string; name: string }> }),
    ]);
    const candidates = [...allApps.applications, ...deptApps.applications, ...fnApps.applications];
    const unique = new Map<string, ApplicationSelection>();
    candidates.forEach((item) => {
      if (selectedSet.has(item.name.trim().toLowerCase())) {
        unique.set(item.id, { id: item.id, name: item.name });
      }
    });
    return [...unique.values()];
  };

  const buildSubmissionResponses = (applicationName: string) => {
    const mappedSelector = allElements.find((item) => item.dataSource === "app_department" || item.dataSource === "app_function");
    const currentValues: Record<string, unknown> = mappedSelector ? { ...values, [mappedSelector.id]: applicationName } : values;

    return allRenderedQuestions
      .filter((entry) => !entry.applicationName || entry.applicationName === applicationName)
      .filter((entry) => entry.element.type !== "hero")
      .map((entry) => ({
        questionId: entry.baseQuestionId,
        value: buildResponseValue(entry.element, currentValues, commentValues),
      }))
      .filter((item) => {
        const value = item.value;
        return Boolean(
          value.textValue ||
          value.dateValue ||
          value.numericValue ||
          (value.matrixValues && Object.keys(value.matrixValues).length > 0) ||
          value.commentValue,
        );
      });
  };

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    if (!validateCurrentPage()) {
      return;
    }

    setSaving(true);
    const respondent = typeof window === "undefined"
      ? { name: "Bapak/Ibu Responden", email: "" }
      : getInitialRespondent(surveyId, new URLSearchParams(window.location.search));
    const selectedApplications = await resolveSelectedApplications();
    if (selectedApplications.length === 0) {
      setSaving(false);
      setError("Pilih minimal satu aplikasi sebelum submit survey.");
      return;
    }

    if (respondent.email) {
      const duplicateResult = await checkDuplicatePublicResponse({
        surveyId,
        email: respondent.email,
        applicationIds: selectedApplications.map((item) => item.id),
      });
      if (!duplicateResult.success) {
        setSaving(false);
        setError(duplicateResult.message || "Gagal memeriksa duplikasi response.");
        return;
      }
      if (duplicateResult.isDuplicate) {
        setSaving(false);
        setError(duplicateResult.message || "Anda sudah mengirim response untuk aplikasi ini.");
        return;
      }
    }

    for (const application of selectedApplications) {
      const result = await submitPublicSurveyResponse({
        surveyId,
        respondent: {
          name: respondent.name,
          email: respondent.email,
          businessUnitId: String(values[allElements.find((item) => item.dataSource === "bu")?.id || ""] || "") || null,
          divisionId: String(values[allElements.find((item) => item.dataSource === "division")?.id || ""] || "") || null,
          departmentId: String(values[allElements.find((item) => item.dataSource === "department")?.id || ""] || "") || null,
        },
        selectedApplicationIds: [application.id],
        responses: buildSubmissionResponses(application.name),
      });

      if (!result.success) {
        setSaving(false);
        setError(result.message || `Gagal mengirim response survey untuk aplikasi ${application.name}.`);
        return;
      }
    }

    setSaving(false);
    setMessage("Response berhasil dikirim. Terima kasih atas partisipasi Anda.");
    setSubmitted(true);
    setCurrentPageIndex(0);
    setValidationErrors({});
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (loading) {
    return (
      <section className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.card}>
            <div className={styles.loadingWrap}>Memuat survey...</div>
          </div>
        </div>
      </section>
    );
  }

  if (error && !form) {
    return (
      <section className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.card}>
            <div className={styles.body}>
              <div className={styles.alertError}>{error}</div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!form || !currentPage) {
    return (
      <section className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.card}>
            <div className={styles.body}>
              <div className={styles.empty}>Survey tidak tersedia.</div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const pageStyle = {
    "--survey-primary": primaryColor,
    "--survey-secondary": secondaryColor,
    backgroundColor: form.configuration?.backgroundColor || undefined,
    backgroundImage: form.configuration?.backgroundImageUrl ? `url(${form.configuration.backgroundImageUrl})` : undefined,
    backgroundSize: form.configuration?.backgroundImageUrl ? "cover" : undefined,
  } as CSSProperties;

  const btnClass = (base: string) =>
    `${base} ${buttonStyle === "pill" ? styles.btnPill : buttonStyle === "square" ? styles.btnSquare : ""}`.trim();

  const currentPageSubtitle = currentPage.title !== `Page ${currentPageIndex + 1}` ? currentPage.title : "";

  if (submitted) {
    return (
      <section className={styles.page} style={pageStyle}>
        <div className={styles.shell}>
          <div className={styles.card}>
            <div className={styles.heroWrap}>
              {heroImageUrl ? (
                <img src={heroImageUrl} alt="Survey header" className={styles.heroImage} />
              ) : (
                <div className={styles.heroImagePlaceholder} />
              )}
              <div className={styles.brandBadge}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/img/logo.png" alt="PT Astra Otoparts Tbk" className={styles.brandBadgeLogo} />
              </div>
            </div>
            <div className={styles.titlebar} style={{ fontFamily: form.configuration?.fontFamily || undefined }}>
              {heroTitle}
            </div>
            <div className={styles.subbar}>
              <span className={`${styles.subbarStatus} ${styles.statusActive}`}>Terima Kasih</span>
            </div>
            <div className={styles.successBody}>
              <div className={styles.successPanel}>
                <div className={styles.successIcon}>✅</div>
                <h2 className={styles.successTitle}>Terima kasih atas partisipasi Anda.</h2>
                <p className={styles.successText}>
                  Response untuk survey ini sudah berhasil dikirim. Anda tidak perlu mengisi ulang halaman ini.
                </p>
                {message ? <div className={styles.alertSuccess}>{message}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page} style={pageStyle}>
      <div className={styles.shell}>
        <div className={styles.card} style={{ fontFamily: form.configuration?.fontFamily || undefined }}>

          {/* Hero image — full width di atas titlebar, dengan logo overlay */}
          <div className={styles.heroWrap}>
            {heroImageUrl ? (
              <img src={heroImageUrl} alt="Survey header" className={styles.heroImage} />
            ) : (
              <div className={styles.heroImagePlaceholder} />
            )}
            {/* Logo Astra Otoparts — pojok kanan atas hero image */}
            <div className={styles.brandBadge}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/img/logo.png" alt="PT Astra Otoparts Tbk" className={styles.brandBadgeLogo} />
            </div>
          </div>

          {/* Title bar — warna primary */}
          <div className={styles.titlebar}>{heroTitle}</div>

          {/* Sub bar — soft primary, berisi subtitle + status + page indicator */}
          <div className={styles.subbar}>
            {renderedQuestions.length > 0 && currentPageSubtitle ? <span>{currentPageSubtitle}</span> : null}
            {renderedQuestions.length > 0 && !currentPageSubtitle && heroSubtitle ? <span>{heroSubtitle}</span> : null}
            <span className={`${styles.subbarStatus} ${effectiveStatus === "Active" ? styles.statusActive : styles.statusClosed}`}>
              {effectiveStatus}
            </span>
            {showPageNumbers ? (
              <span className={styles.subbarPage}>
                Page {currentPageIndex + 1} / {pageGroups.length}
              </span>
            ) : null}
          </div>

          {/* Body */}
          <div className={styles.body}>
            {error ? <div className={styles.alertError}>{error}</div> : null}
            {message ? <div className={styles.alertSuccess}>{message}</div> : null}

            {showProgress && !isWelcomePage ? (
              <div className={styles.progressWrap}>
                <div className={styles.progressTrack}>
                  <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
                </div>
                <div className={styles.progressMeta}>{Math.round(progressPercent)}% selesai</div>
              </div>
            ) : null}

            <div className={styles.questionList}>
              {renderedQuestions.length === 0 ? (
                // Welcome page — hanya hero image + titlebar + subbar + Next
                // Tidak ada konten di body, sesuai mockup page1.html
                <div className={styles.welcomeBody} />
              ) : (
                renderedQuestions.map(({ element, sourceQuestion, applicationName }) => {
                const effectiveRequired = element.required || isConditionallyRequired(element, values);
                const effectiveElement = { ...element, required: effectiveRequired };
                const ratingThreshold = Number((sourceQuestion.options || {}).commentRequiredBelowRating || 0);
                const ratingValue = Number(values[element.id] || 0);
                const showRatingComment = effectiveElement.type === "rating" && ratingThreshold > 0 && ratingValue > 0 && ratingValue < ratingThreshold;

                return (
                  <div key={element.id} className={styles.question}>
                    {applicationName ? <div className={styles.appGroupLabel}>{applicationName}</div> : null}
                    {effectiveElement.type !== "hero" && effectiveElement.title.trim() ? (
                      <label className={styles.questionLabel}>
                        {effectiveElement.title}
                        {effectiveElement.required ? <span style={{ color: "#cc0033", marginLeft: 2 }}>*</span> : null}
                      </label>
                    ) : null}
                    {effectiveElement.type !== "hero" && effectiveElement.subtitle ? (
                      <span className={styles.questionHelp}>{effectiveElement.subtitle}</span>
                    ) : null}
                    <SurveyPreviewElement
                      element={effectiveElement}
                      allElements={allElements}
                      values={values}
                      onSetValue={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
                      onSetValuesBulk={(nextValues) => setValues((prev) => ({ ...prev, ...nextValues }))}
                      onToggleCheckbox={toggleCheckbox}
                      orgData={{
                        businessUnits: masterData.businessUnits,
                        divisions: masterData.divisions,
                        departments: masterData.departments,
                        functions: masterData.functions,
                        mappedApplicationsByDepartment,
                        mappedApplicationsByFunction,
                      }}
                    />
                    {showRatingComment ? (
                      <div className={styles.inlineField}>
                        <label className={styles.inlineLabel}>
                          Komentar wajib untuk rating di bawah {ratingThreshold}
                        </label>
                        <textarea
                          className={styles.textarea}
                          value={commentValues[element.id] || ""}
                          onChange={(event) => setCommentValues((prev) => ({ ...prev, [element.id]: event.target.value }))}
                        />
                      </div>
                    ) : null}
                    {validationErrors[element.id] ? (
                      <div className={styles.errorText}>{validationErrors[element.id]}</div>
                    ) : null}
                    {/* Error komentar per row likert */}
                    {effectiveElement.type === "likert" ? (() => {
                      const rawOpts = effectiveElement.options;
                      const lastOpt = rawOpts[rawOpts.length - 1];
                      const lastNum = Number(lastOpt);
                      const hasScale = rawOpts.length > 0 && Number.isFinite(lastNum) && lastNum >= 1 && lastNum <= 10 && String(Math.round(lastNum)) === String(lastOpt);
                      const rowCount = (hasScale ? rawOpts.slice(0, -1) : rawOpts).length;
                      return Array.from({ length: rowCount }, (_, rowIdx) => {
                        const commentKey = `${effectiveElement.id}-comment-${rowIdx}`;
                        return validationErrors[commentKey] ? (
                          <div key={commentKey} className={styles.errorText}>{validationErrors[commentKey]}</div>
                        ) : null;
                      });
                    })() : null}
                  </div>
                );
              })
              )}
            </div>

            {/* Navigation */}
            <div className={`${styles.nav} ${renderedQuestions.length === 0 ? styles.navCenter : ""}`}>
              {renderedQuestions.length > 0 ? (
                <button
                  type="button"
                  className={btnClass(styles.btnGhost)}
                  disabled={currentPageIndex === 0 || saving}
                  onClick={() => {
                    setValidationErrors({});
                    setCurrentPageIndex((prev) => Math.max(0, prev - 1));
                    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Prev
                </button>
              ) : null}
              {currentPageIndex === pageGroups.length - 1 ? (
                <button
                  type="button"
                  className={btnClass(styles.btn)}
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                >
                  {saving ? "Submitting..." : "Submit"}
                </button>
              ) : (
                <button
                  type="button"
                  className={btnClass(styles.btn)}
                  disabled={saving}
                  onClick={() => {
                    if (!validateCurrentPage()) return;
                    setCurrentPageIndex((prev) => Math.min(pageGroups.length - 1, prev + 1));
                    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
