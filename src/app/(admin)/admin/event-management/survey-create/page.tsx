"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { fetchSurveyById, updateEventById, updateEventConfiguration, fetchSurveyQuestions, fetchSurveyResponseStatistics, createSurveyQuestion, updateSurveyQuestion, deleteSurveyQuestion, uploadSurveyQuestionImage } from "@/lib/surveys";
import { fetchOrgHierarchy, type BusinessUnitOption, type DivisionOption, type DepartmentOption } from "@/lib/org-hierarchy";
import { fetchFunctionsMaster, type FunctionMaster } from "@/lib/master-data";
import { fetchMappedApplicationsByDepartment, fetchMappedApplicationsByFunction } from "@/lib/mappings";
import { canPublishEvent, resolveEventStatus } from "@/lib/event-status";
import { useSearchParams, useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import styles from "./survey-create.module.css";
import SurveyBuilderEditor from "./survey-builder-editor";
import SurveyPreviewScreen from "./survey-preview-screen";
import SurveySettingsModals from "./survey-settings-modals";
import SurveyTemplatePicker from "./survey-template-picker";
import {
  BUILDER_TEMPLATES,
  ELEMENTS,
  getTemplatePreviewStyle,
  sanitizeSurveyDescription,
  type BuilderElement,
  type BuilderPage,
  type BuilderTemplate,
  type DraftPayload,
  type ElementType,
  type FontPreset,
} from "./builder-definitions";
import {
  dataUrlToBlob,
  ensureUniqueElementIds,
  extractQuestionId,
  formatScheduleValue,
  formatScheduleValueWithSeconds,
  getCorpTemplatePages,
  getMaxTempElementCounter,
  inferProfileField,
  newElement,
  normalizePagesForState,
  parseScheduleInputDate,
  renumberPages,
  toApiType,
  toScheduleInputValue,
  toPages,
} from "./builder-utils";
import {
  applyMasterDataSource,
  buildEventConfigurationPayload,
  buildEventUpdatePayload,
  buildTemplatePages,
  hasMappedSelectorInPage,
  shouldShowVisibilityControl,
} from "./builder-page-helpers";

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
      setScheduleStart(toScheduleInputValue(detail.StartDate, "start"));
      setScheduleEnd(toScheduleInputValue(detail.EndDate, "end"));
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
            setScheduleStart(toScheduleInputValue(detail.StartDate, "start"));
            setScheduleEnd(toScheduleInputValue(detail.EndDate, "end"));
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
            setMessage("Memuat backup draft lokal yang lebih baru dari server. Jadwal event tetap mengikuti data server.");
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

  const addPage = () => {
    setPages((prev) => {
      const nextId = prev.length + 1;
      return [...prev, { id: nextId, title: nextId === 1 ? "Welcome" : `Page ${nextId}`, elements: [] }];
    });
  };

  const addElement = (pageId: number, type: ElementType) => {
    const nextCounter = elementCounter + 1;
    const tempId = `temp-${nextCounter}`;

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
    const tempId = `temp-${nextCounter}`;

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
    const start = parseScheduleInputDate(scheduleStart, "start");
    const end = parseScheduleInputDate(scheduleEnd, "end");
    if (start && end && start.getTime() > end.getTime()) {
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
          if (item.element.type === "likert") return { variant: "likert", rows: item.element.options, ratingScale: item.element.ratingScale ?? 10, ...pageMeta, ...displayCondition, ...conditionalRequired };
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

    const eventState = {
      surveyTitle,
      surveyDesc,
      targetRespondents,
      targetScore,
      scheduleStart,
      scheduleEnd,
    };
    const styleState = {
      logo,
      bgColor,
      bgImage,
      font,
      heroTitle,
      heroSubtitle,
      primaryColor,
      secondaryColor,
      buttonStyle,
      showProgressBar,
      showPageNumbers,
      multiPage,
    };
    const updatePayload = buildEventUpdatePayload(eventState, "Draft");

    setSaving(true);
    const update = await updateEventById(surveyId, updatePayload);
    setSaving(false);

    if (!update.success) {
      setError(update.message || "Draft lokal tersimpan, sinkron server gagal");
      return;
    }

    const configUpdate = await updateEventConfiguration(
      surveyId,
      buildEventConfigurationPayload(eventState, styleState),
    );
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

    const eventState = {
      surveyTitle,
      surveyDesc,
      targetRespondents,
      targetScore,
      scheduleStart,
      scheduleEnd,
    };
    const styleState = {
      logo,
      bgColor,
      bgImage,
      font,
      heroTitle,
      heroSubtitle,
      primaryColor,
      secondaryColor,
      buttonStyle,
      showProgressBar,
      showPageNumbers,
      multiPage,
    };
    const updatePayload = buildEventUpdatePayload(eventState, "Active");

    if (!canPublishEvent(updatePayload.endDate)) {
      setError(
        `Publish diblok karena End Date sudah lewat. End Date: ${formatScheduleValueWithSeconds(updatePayload.endDate)}. Waktu sekarang: ${formatScheduleValueWithSeconds(new Date())}.`,
      );
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

    if (!canPublishEvent(updatePayload.endDate)) {
      setPublishing(false);
      setError(
        `Publish dibatalkan karena End Date terlewati saat proses sinkronisasi. End Date: ${formatScheduleValueWithSeconds(updatePayload.endDate)}. Waktu sekarang: ${formatScheduleValueWithSeconds(new Date())}.`,
      );
      return;
    }

    const update = await updateEventById(surveyId, updatePayload);
    setPublishing(false);

    if (!update.success) {
      setError(update.message || "Gagal publish");
      return;
    }

    const configUpdate = await updateEventConfiguration(
      surveyId,
      buildEventConfigurationPayload(eventState, styleState),
    );
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
      setError(
        `Publish tersimpan, tetapi status efektif sekarang ${latestStatus || "-"}. Period event: ${formatScheduleValue(verifyActive.survey.StartDate)} - ${formatScheduleValue(verifyActive.survey.EndDate)}.`,
      );
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
    const builtTemplate = buildTemplatePages(template, elementCounter);
    setPages(builtTemplate.pages);
    setElementCounter(builtTemplate.nextCounter);
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
        <SurveyPreviewScreen
          allBuilderElements={allBuilderElements}
          logo={logo}
          mappedApplicationsByDepartment={mappedApplicationsByDepartment}
          mappedApplicationsByFunction={mappedApplicationsByFunction}
          orgBusinessUnits={orgBusinessUnits}
          orgDepartments={orgDepartments}
          orgDivisions={orgDivisions}
          orgFunctions={orgFunctions}
          pages={pages}
          previewDevice={previewDevice}
          previewValues={previewValues}
          setPreviewDevice={setPreviewDevice}
          setPreviewValue={setPreviewValue}
          setPreviewValuesBulk={setPreviewValuesBulk}
          setShowPreview={setShowPreview}
          surveyDesc={surveyDesc}
          surveyTitle={surveyTitle}
          togglePreviewCheckbox={togglePreviewCheckbox}
        />
      ) : (
        <SurveyBuilderEditor
          addElement={addElement}
          addElementToLastPage={addElementToLastPage}
          addPage={addPage}
          applyMasterDataSource={(source, element) =>
            applyMasterDataSource(source, element, {
              businessUnits: orgBusinessUnits,
              divisions: orgDivisions,
              departments: orgDepartments,
              functions: orgFunctions,
            })
          }
          bgColor={bgColor}
          bgImage={bgImage}
          brandStyleSummary={styleSummary}
          buttonStyle={buttonStyle}
          dragOverPageId={dragOverPageId}
          draggingPageId={draggingPageId}
          font={font}
          hasMappedSelectorInPage={hasMappedSelectorInPage}
          heroSubtitle={heroSubtitle}
          heroTitle={heroTitle}
          loadingPublish={publishing}
          loadingSave={saving}
          logo={logo}
          moveElementWithinPage={moveElementWithinPage}
          onFile={onFile}
          onPageDragEnd={onPageDragEnd}
          onPageDragOver={onPageDragOver}
          onPageDragStart={onPageDragStart}
          onPageDrop={onPageDrop}
          openPreview={() => setShowPreview(true)}
          openSchedule={() => setShowSchedule(true)}
          openStyle={() => setShowStyle(true)}
          openTemplatePicker={() => setShowTemplatePicker(true)}
          pages={pages}
          primaryColor={primaryColor}
          publish={publish}
          removePage={removePage}
          saveDraft={saveDraft}
          scheduleSummary={scheduleSummary}
          secondaryColor={secondaryColor}
          setPages={setPages}
          setPreviewValues={setPreviewValues}
          setSurveyDesc={setSurveyDesc}
          setSurveyTitle={setSurveyTitle}
          setTargetRespondents={setTargetRespondents}
          setTargetScore={setTargetScore}
          shouldShowVisibilityControl={shouldShowVisibilityControl}
          surveyDesc={surveyDesc}
          surveyTitle={surveyTitle}
          targetRespondents={targetRespondents}
          targetScore={targetScore}
        />
      )}
      <SurveySettingsModals
        bgColor={bgColor}
        buttonStyle={buttonStyle}
        font={font}
        heroSubtitle={heroSubtitle}
        heroTitle={heroTitle}
        multiPage={multiPage}
        onFile={onFile}
        primaryColor={primaryColor}
        scheduleEnd={scheduleEnd}
        scheduleStart={scheduleStart}
        secondaryColor={secondaryColor}
        setBgColor={setBgColor}
        setBgImage={setBgImage}
        setButtonStyle={setButtonStyle}
        setFont={setFont}
        setHeroSubtitle={setHeroSubtitle}
        setHeroTitle={setHeroTitle}
        setLogo={setLogo}
        setMultiPage={setMultiPage}
        setPrimaryColor={setPrimaryColor}
        setScheduleEnd={setScheduleEnd}
        setScheduleStart={setScheduleStart}
        setSecondaryColor={setSecondaryColor}
        setShowPageNumbers={setShowPageNumbers}
        setShowProgressBar={setShowProgressBar}
        setShowSchedule={setShowSchedule}
        setShowStyle={setShowStyle}
        showPageNumbers={showPageNumbers}
        showProgressBar={showProgressBar}
        showSchedule={showSchedule}
        showStyle={showStyle}
      />

      {showTemplatePicker ? (
        <SurveyTemplatePicker
          elementIconMap={elementIconMap}
          filteredTemplates={filteredTemplates}
          getTemplatePreviewStyle={getTemplatePreviewStyle}
          onApplySelectedTemplate={onApplySelectedTemplate}
          onClose={() => { setShowTemplatePicker(false); setShowTemplateConfirm(false); }}
          onConfirmReplace={() => {
            if (!selectedTemplate) return;
            applyTemplate(selectedTemplate);
          }}
          onSelectTemplate={onSelectTemplate}
          selectedTemplate={selectedTemplate}
          selectedTemplateId={selectedTemplateId}
          setShowTemplateConfirm={setShowTemplateConfirm}
          setTemplateCategory={setTemplateCategory}
          setTemplateSearch={setTemplateSearch}
          showTemplateConfirm={showTemplateConfirm}
          templateCategory={templateCategory}
          templateSearch={templateSearch}
        />
      ) : null}

    </section>
  );
}