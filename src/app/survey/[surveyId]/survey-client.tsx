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
  const optionSource = Array.isArray(options.options)
    ? options.options
    : type === "likert"
      ? Array.isArray(options.rows) ? options.rows : []
      : type === "matrix"
        ? Array.isArray(options.columns) ? options.columns : []
        : [];

  return {
    id: question.questionId,
    type,
    title: question.promptText || "",
    subtitle: question.subtitle || "",
    required: Boolean(question.isMandatory),
    options: optionSource.map((item) => String(item)),
    coverUrl: type === "hero" ? String(question.imageUrl || options.heroImageUrl || "") : "",
    dataSource: typeof options.dataSource === "string" ? (options.dataSource as PreviewElement["dataSource"]) : undefined,
    optionLayout: options.layout === "horizontal" ? "horizontal" : "vertical",
    allowMultipleAnswers: Boolean(options.allowMultipleAnswers),
    displayCondition: options.displayCondition === "after_mapped_selection" ? "after_mapped_selection" : "always",
    conditionalRequiredSourceId: typeof conditionalRequired.sourceElementId === "string"
      ? String(conditionalRequired.sourceElementId)
      : undefined,
    conditionalRequiredThreshold: Number.isFinite(Number(conditionalRequired.threshold))
      ? Number(conditionalRequired.threshold)
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
      questions: groups.flatMap((group) => group.questions),
    }];
  }
  return groups;
}

function buildRenderedQuestionsForPage(page: PageGroup | null, values: Record<string, unknown>): RenderedQuestion[] {
  if (!page) return [];

  const normalizedElements = page.questions.map(normalizeQuestion);
  const mappedSelectorIndex = normalizedElements.findIndex(
    (item) => item.dataSource === "app_department" || item.dataSource === "app_function",
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

  const repeatedQuestions = selectedMappedApps.flatMap((appName) =>
    repeatableAfterSelector.map((element) => ({
      element: {
        ...element,
        id: toContextElementId(element.id, appName),
        title: `${element.title || "Question"} (${appName})`,
        conditionalRequiredSourceId: element.conditionalRequiredSourceId
          ? toContextElementId(element.conditionalRequiredSourceId, appName)
          : undefined,
      },
      sourceQuestion: questionMap.get(element.id) as PublicQuestion,
      applicationName: appName,
      baseQuestionId: element.id,
    })),
  );

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
    const matrixValues = Object.fromEntries(
      element.options.map((_, rowIdx) => {
        const key = `${element.id}-${rowIdx}`;
        return [rowIdx, Number(values[key] || 0)];
      }).filter(([, value]) => Number.isFinite(value) && value > 0),
    );
    return { matrixValues: Object.keys(matrixValues).length > 0 ? matrixValues : null };
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
            Code: "",
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
  const heroTitle = form?.configuration?.heroTitle || form?.title || "Survey";
  const heroSubtitle = form?.configuration?.heroSubtitle || form?.description || "";
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
  };

  if (loading) {
    return <section className={styles.page}><div className={styles.shell}><div className={styles.alertInfo}>Memuat survey...</div></div></section>;
  }

  if (error && !form) {
    return <section className={styles.page}><div className={styles.shell}><div className={styles.alertError}>{error}</div></div></section>;
  }

  if (!form || !currentPage) {
    return <section className={styles.page}><div className={styles.shell}><div className={styles.empty}>Survey tidak tersedia.</div></div></section>;
  }

  return (
    <section
      className={styles.page}
      style={{
        "--survey-primary": primaryColor,
        "--survey-secondary": secondaryColor,
        backgroundColor: form.configuration?.backgroundColor || undefined,
        backgroundImage: form.configuration?.backgroundImageUrl ? `url(${form.configuration.backgroundImageUrl})` : undefined,
        backgroundSize: form.configuration?.backgroundImageUrl ? "cover" : undefined,
      } as CSSProperties}
    >
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.hero} style={{ fontFamily: form.configuration?.fontFamily || undefined }}>
            {form.configuration?.logoUrl ? <img src={form.configuration.logoUrl} alt="Survey logo" className={styles.logo} /> : null}
            <h1 className={styles.title}>{heroTitle}</h1>
            {heroSubtitle ? <p className={styles.subtitle}>{heroSubtitle}</p> : null}
            <div className={styles.meta}>
              <span className={`${styles.metaItem} ${effectiveStatus === "Active" ? styles.statusActive : styles.statusClosed}`}>{effectiveStatus}</span>
              {showPageNumbers ? <span className={styles.metaItem}>Page {currentPageIndex + 1} of {pageGroups.length}</span> : null}
            </div>
          </div>

          <div className={styles.body}>
            {error ? <div className={styles.alertError}>{error}</div> : null}
            {message ? <div className={styles.alertSuccess}>{message}</div> : null}

            {showProgress ? (
              <div className={styles.progressWrap}>
                <div className={styles.progressTrack}><div className={styles.progressBar} style={{ width: `${progressPercent}%` }} /></div>
                <div className={styles.progressMeta}>{Math.round(progressPercent)}% selesai</div>
              </div>
            ) : null}

            <h2 className={styles.pageTitle}>{currentPage.title}</h2>

            <div className={styles.questionList}>
              {renderedQuestions.map(({ element, sourceQuestion, applicationName }) => {
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
                        {effectiveElement.required ? " *" : ""}
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
                        <label className={styles.inlineLabel}>Komentar wajib untuk rating di bawah {ratingThreshold}</label>
                        <textarea
                          className={styles.textarea}
                          value={commentValues[element.id] || ""}
                          onChange={(event) => setCommentValues((prev) => ({ ...prev, [element.id]: event.target.value }))}
                        />
                      </div>
                    ) : null}
                    {validationErrors[element.id] ? <div className={styles.errorText}>{validationErrors[element.id]}</div> : null}
                  </div>
                );
              })}
            </div>

            <div className={styles.nav}>
              <button
                type="button"
                className={`${styles.btnGhost} ${buttonStyle === "pill" ? styles.btnPill : buttonStyle === "square" ? styles.btnSquare : ""}`}
                disabled={currentPageIndex === 0 || saving}
                onClick={() => {
                  setValidationErrors({});
                  setCurrentPageIndex((prev) => Math.max(0, prev - 1));
                }}
              >
                Previous
              </button>
              {currentPageIndex === pageGroups.length - 1 ? (
                <button
                  type="button"
                  className={`${styles.btn} ${buttonStyle === "pill" ? styles.btnPill : buttonStyle === "square" ? styles.btnSquare : ""}`}
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                >
                  {saving ? "Submitting..." : "Submit Response"}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.btn} ${buttonStyle === "pill" ? styles.btnPill : buttonStyle === "square" ? styles.btnSquare : ""}`}
                  disabled={saving}
                  onClick={() => {
                    if (!validateCurrentPage()) return;
                    setCurrentPageIndex((prev) => Math.min(pageGroups.length - 1, prev + 1));
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
