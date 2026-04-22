"use client";

import { getCurrentUser } from "@/lib/auth";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import { fetchFunctionsMaster } from "@/lib/master-data";
import { getEventStatusLabel } from "@/lib/event-status";
import {
  exportSurveyReport,
  fetchReportSelectionList,
  fetchTakeoutComparison,
  generateSurveyReport,
  type ReportSelectionItem,
  type TakeoutComparisonRow,
} from "@/lib/reports";
import type { UserRole } from "@/types/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import baseStyles from "../page-mockup.module.css";
import styles from "./report.module.css";
import {
  formatDate,
  formatNumber,
  mapSelectionStatus,
  normalizeRole,
  toScore,
} from "./report-utils";

type TakeoutTableRow = {
  surveyId: string;
  surveyTitle: string;
  functionName: string;
  respondent: string;
  application: string;
  questionCode: string;
  questionText: string;
  scoreBefore: number | null;
  scoreAfter: number | null;
  isTakeout: boolean;
  reason: string;
};

type ModalState =
  | { type: "none" }
  | { type: "confirm-generate"; survey: ReportSelectionItem }
  | { type: "comment-detail"; row: TakeoutTableRow }
  | { type: "export"; survey: ReportSelectionItem; format: "excel" | "pdf" };

export default function ReportSelectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSurveyId = String(searchParams.get("surveyId") || "");

  const currentUser = getCurrentUser();
  const role: UserRole | null = currentUser?.role ?? null;
  const normalizedRole = normalizeRole(String(role || ""));
  const isSuperAdmin = normalizedRole === "superadmin";
  const isAdminEvent = normalizedRole === "adminevent";
  const isItLead = normalizedRole === "itlead";
  const isDepartmentHead = normalizedRole === "departmenthead";
  const canAccess = isSuperAdmin || isAdminEvent || isItLead || isDepartmentHead;
  const canGenerateAndExport = isAdminEvent;

  const [surveys, setSurveys] = useState<ReportSelectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [searchBy, setSearchBy] = useState<string>("all");
  const [surveySearch, setSurveySearch] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState<string>("all");
  const [appliedSurveySearch, setAppliedSurveySearch] = useState("");
  const [eventStatusFilter, setEventStatusFilter] = useState<string>("all");
  const [selectedTakeoutSurvey, setSelectedTakeoutSurvey] = useState<string>(preselectedSurveyId || "all");
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>("all");
  const [functionOptions, setFunctionOptions] = useState<Array<{ value: string; label: string }>>([{ value: "all", label: "All Functions" }]);

  const [takeoutRows, setTakeoutRows] = useState<TakeoutTableRow[]>([]);
  const [takeoutLoading, setTakeoutLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [exporting, setExporting] = useState(false);

  const loadSurveyList = async (): Promise<ReportSelectionItem[]> => {
    const listResult = await fetchReportSelectionList();
    if (!listResult.success) {
      setError(listResult.message || "Gagal memuat daftar event report");
      setSurveys([]);
      return [];
    }

    setError("");
    setSurveys(listResult.surveys);
    return listResult.surveys;
  };

  useEffect(() => {
    const run = async () => {
      try {
        const shouldLoadFunctionOptions = isSuperAdmin || isAdminEvent;
        const requests: [Promise<ReportSelectionItem[]>, Promise<Awaited<ReturnType<typeof fetchFunctionsMaster>> | null>] = [
          loadSurveyList(),
          shouldLoadFunctionOptions ? fetchFunctionsMaster() : Promise.resolve(null),
        ];
        const [, functionResult] = await Promise.all(requests);

        if (functionResult?.success) {
          const dynamic = functionResult.data
            .filter((item) => item.IsActive !== false)
            .map((item) => ({ value: item.FunctionId, label: item.Name }));
          setFunctionOptions([{ value: "all", label: "All Functions" }, ...dynamic]);
        } else {
          setFunctionOptions([{ value: "all", label: "All Functions" }]);
        }
      } catch {
        setError("Terjadi kesalahan saat memuat data report.");
        setSurveys([]);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [isAdminEvent, isSuperAdmin]);

  const filteredSurveyRows = useMemo(() => {
    const term = appliedSurveySearch.trim().toLowerCase();
    return surveys.filter((item) => {
      if (eventStatusFilter !== "all") {
        const normalizedStatus = mapSelectionStatus(item);
        if (normalizedStatus !== eventStatusFilter) return false;
      }
      if (!term) return true;
      const name = String(item.title || "").toLowerCase();
      const period = String(item.period || "").toLowerCase();
      const respondent = String(item.respondentCount || "").toLowerCase();

      if (appliedSearchBy === "event") return name.includes(term);
      if (appliedSearchBy === "period") return period.includes(term);
      if (appliedSearchBy === "respondent") return respondent.includes(term);
      return name.includes(term) || period.includes(term) || respondent.includes(term);
    });
  }, [appliedSearchBy, appliedSurveySearch, eventStatusFilter, surveys]);

  const lastUpdatedText = useMemo(() => {
    const generatedDates = surveys
      .map((item) => item.generatedAt)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));

    if (generatedDates.length === 0) return "-";

    const latest = generatedDates.reduce((previous, current) =>
      current.getTime() > previous.getTime() ? current : previous
    );

    return formatDate(latest.toISOString());
  }, [surveys]);

  const selectedFunctionLabel = useMemo(
    () => functionOptions.find((item) => item.value === selectedFunctionId)?.label || "-",
    [functionOptions, selectedFunctionId],
  );
  const surveyFilterOptions = useMemo(
    () => [{ value: "all", label: "All Surveys" }, ...surveys.map((item) => ({ value: item.surveyId, label: item.title }))],
    [surveys]
  );
  const exportFormatOptions = useMemo(
    () => [
      { value: "excel", label: "Excel (.xlsx)" },
      { value: "pdf", label: "PDF (Print View)" },
    ],
    []
  );
  const eventStatusOptions = useMemo(
    () => [
      { value: "all", label: "All Status" },
      { value: "generated", label: "Generated" },
      { value: "active", label: "Active" },
      { value: "draft", label: "Draft" },
      { value: "closed", label: "Closed" },
      { value: "archived", label: "Archived" },
      { value: "other", label: "Other" },
    ],
    []
  );

  const onApplySearch = () => {
    setAppliedSearchBy(searchBy);
    setAppliedSurveySearch(surveySearch);
  };
  const searchByOptions = useMemo(
    () => [
      { value: "all", label: "Search By" },
      { value: "event", label: "Nama Event" },
      { value: "period", label: "Periode" },
      { value: "respondent", label: "Responden" },
    ],
    []
  );

  const loadTakeoutRows = useCallback(async () => {
    setTakeoutLoading(true);
    setError("");
    setMessage("");
    setTakeoutRows([]);

    const surveyTargets = selectedTakeoutSurvey === "all"
      ? surveys
      : surveys.filter((item) => item.surveyId === selectedTakeoutSurvey);

    if (surveyTargets.length === 0) {
      setTakeoutRows([]);
      setTakeoutLoading(false);
      return;
    }

    const functionId = selectedFunctionId === "all" ? undefined : selectedFunctionId;
    const allRows: TakeoutTableRow[] = [];

    try {
      for (const survey of surveyTargets) {
        const result = await fetchTakeoutComparison({ surveyId: survey.surveyId, functionId });
        if (!result.success) {
          setError(result.message || "Gagal memuat comparison takeout");
          return;
        }

        result.comparison.forEach((item: TakeoutComparisonRow, index) => {
          allRows.push({
            surveyId: survey.surveyId,
            surveyTitle: survey.title,
            functionName: selectedFunctionId === "all" ? "-" : selectedFunctionLabel,
            respondent: "-",
            application: "-",
            questionCode: `Q${index + 1}`,
            questionText: item.questionText || "Question",
            scoreBefore: item.avgScoreBefore,
            scoreAfter: item.avgScoreAfter,
            isTakeout: Number(item.takeoutCount || 0) > 0,
            reason: String(item.takeoutReasons || "").trim(),
          });
        });
      }
    } catch {
      setError("Terjadi kesalahan saat memuat data comparison takeout.");
      setTakeoutRows([]);
      return;
    } finally {
      setTakeoutLoading(false);
    }

    setTakeoutRows(allRows);
  }, [selectedFunctionId, selectedFunctionLabel, selectedTakeoutSurvey, surveys]);

  useEffect(() => {
    if (!loading) {
      void loadTakeoutRows();
    }
  }, [loadTakeoutRows, loading]);

  const takeoutStats = useMemo(() => {
    const total = takeoutRows.length;
    const removed = takeoutRows.filter((row) => row.isTakeout).length;
    const beforeValues = takeoutRows.map((row) => row.scoreBefore).filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
    const afterValues = takeoutRows.map((row) => row.scoreAfter).filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
    const avgBefore = beforeValues.length > 0 ? beforeValues.reduce((sum, value) => sum + value, 0) / beforeValues.length : null;
    const avgAfter = afterValues.length > 0 ? afterValues.reduce((sum, value) => sum + value, 0) / afterValues.length : null;
    return { total, removed, avgBefore, avgAfter };
  }, [takeoutRows]);

  const runGenerateReport = async (survey: ReportSelectionItem) => {
    setModal({ type: "none" });
    setError("");
    setMessage("");

    const result = await generateSurveyReport({ surveyId: survey.surveyId, includeTakenOut: false });
    if (!result.success) {
      setError(result.message || "Gagal generate report");
      return;
    }
    const refreshed = await loadSurveyList();
    let updated = refreshed.find((item) => item.surveyId === survey.surveyId);
    if (!updated?.hasGeneratedReport) {
      // Retry once after 1.5s — BE may need a moment to persist the flag
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const retried = await loadSurveyList();
      updated = retried.find((item) => item.surveyId === survey.surveyId);
    }
    if (!updated?.hasGeneratedReport) {
      setError("Generate report belum tersimpan penuh di backend. Coba refresh atau regenerate sekali lagi setelah backend aktif terbaru.");
      return;
    }
    setMessage(`Report untuk "${survey.title}" berhasil di-generate.`);
  };

  const runExportReport = async (survey: ReportSelectionItem, format: "excel" | "pdf") => {
    if (format === "pdf") {
      const url = `/admin/report/${encodeURIComponent(survey.surveyId)}?print=pdf&autoprint=1`;
      window.open(url, "_blank", "noopener,noreferrer");
      setModal({ type: "none" });
      setMessage("Mode export PDF dibuka. Simpan hasil print sebagai PDF dari browser.");
      return;
    }

    setExporting(true);
    setError("");
    const result = await exportSurveyReport({
      surveyId: survey.surveyId,
      format,
      includeTakenOut: false,
    });
    setExporting(false);

    if (!result.success || !result.blob || !result.filename) {
      setError(result.message || "Gagal export report");
      return;
    }

    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setModal({ type: "none" });
    setMessage(`Export ${format.toUpperCase()} berhasil diproses.`);
  };

  const openReportView = (survey: ReportSelectionItem) => {
    router.push(`/admin/report/${encodeURIComponent(survey.surveyId)}`);
  };

  if (!canAccess) {
    return (
      <section className={baseStyles.panel}>
        <h1 className={baseStyles.title}>Akses Ditolak</h1>
        <p className={baseStyles.subtitle}>Role Anda tidak memiliki akses ke halaman report.</p>
      </section>
    );
  }

  return (
    <>
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Report</h1>
          <div className={baseStyles.subtitle}>{!canGenerateAndExport ? "Pilih survey untuk melihat laporan (readonly)." : "Pilih event untuk melihat laporan."}</div>
        </div>
      </div>

      <section className={baseStyles.panel}>
        <div className={baseStyles.panelHeader}>
          <h2 className={baseStyles.panelTitle}>Daftar Event</h2>
          <span className={baseStyles.meta}>Terakhir diperbarui: {lastUpdatedText}</span>
        </div>
        <div className={baseStyles.filterToolbar}>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label className={baseStyles.filterLabel}>Status</label>
            <Dropdown
              className={baseStyles.filterControl}
              fullWidth
              options={eventStatusOptions}
              value={eventStatusFilter}
              onChange={setEventStatusFilter}
            />
          </div>
          <SearchBar
            options={searchByOptions}
            selectedValue={searchBy}
            keyword={surveySearch}
            onSelectedValueChange={setSearchBy}
            onKeywordChange={setSurveySearch}
            onButtonClick={onApplySearch}
            placeholder={
              searchBy === "event" ? "Cari nama event..." :
              searchBy === "period" ? "Cari periode..." :
              searchBy === "respondent" ? "Cari responden..." :
              "Cari event..."
            }
          />
        </div>

        <div className={styles.statusRegion} aria-live="polite">
          {loading ? <p className={baseStyles.meta}>Memuat event report...</p> : null}
          {error ? <p className={styles.errorText}>{error}</p> : null}
          {message ? <p className={styles.successText}>{message}</p> : null}
        </div>

        <div className={baseStyles.tableWrap}>
          <table className={`${baseStyles.table} ${styles.reportTable}`}>
            <thead>
              <tr>
                <th scope="col" className={styles.colEvent}>Nama Event</th>
                <th scope="col" className={styles.colPeriod}>Periode</th>
                <th scope="col" className={styles.colStatus}>Status</th>
                <th scope="col" className={styles.colRespondent}>Responden</th>
                <th scope="col" className={styles.colAction}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSurveyRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>Tidak ada event report</td>
                </tr>
              ) : (
                filteredSurveyRows.map((item) => {
                  const mappedStatus = mapSelectionStatus(item);
                  const hasResponses = Number(item.respondentCount || 0) > 0;
                  const isGenerated = mappedStatus === "generated";
                  return (
                    <tr key={item.surveyId} className={styles.reportRow}>
                      <td className={styles.colEvent}>{item.title}</td>
                      <td className={styles.colPeriod}>{item.period || "-"}</td>
                      <td className={styles.colStatus}>
                        {isGenerated ? (
                          <span className={`${baseStyles.badge} ${styles.badgeGenerated}`}>Generated</span>
                        ) : (
                          <span className={styles.statusText}>{getEventStatusLabel(item.status)}</span>
                        )}
                      </td>
                      <td className={styles.colRespondent}>{formatNumber(item.respondentCount)}</td>
                      <td className={styles.actionCell}>
                        <div className={styles.actions}>
                          {!canGenerateAndExport ? (
                            <button
                              type="button"
                              className={styles.buttonSecondaryXs}
                              disabled={!isGenerated}
                              onClick={() => openReportView(item)}
                            >
                              View Report
                            </button>
                          ) : (
                            <>
                              {isGenerated ? (
                                <>
                                  <button
                                    type="button"
                                    className={styles.buttonPrimaryXs}
                                    disabled={!hasResponses}
                                    onClick={() => setModal({ type: "confirm-generate", survey: item })}
                                  >
                                    Regenerate Report
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.buttonSecondaryXs}
                                    disabled={!hasResponses}
                                    onClick={() => openReportView(item)}
                                  >
                                    View Report
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.buttonPrimaryXs}
                                  disabled={!hasResponses}
                                  onClick={() => setModal({ type: "confirm-generate", survey: item })}
                                >
                                  Generate Report
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.buttonGhostXs}
                                disabled={!isGenerated}
                                onClick={() => setModal({ type: "export", survey: item, format: "excel" })}
                              >
                                Export
                              </button>
                            </>
                          )}
                        </div>
                        {!hasResponses ? <span className={styles.actionHint}>Belum ada response final approved</span> : null}
                        {hasResponses && !isGenerated ? <span className={styles.actionHint}>Generate report terlebih dahulu</span> : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={baseStyles.panel}>
        <div className={baseStyles.panelHeader}>
          <h2 className={baseStyles.panelTitle}>Propose Takeout Score Comparison</h2>
          <span className={baseStyles.meta}>Before vs after per question detail (takeout removes score from average).</span>
        </div>
        <div className={`${baseStyles.filterGrid} ${styles.comparisonFilterGrid}`}>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label}>Survey</label>
            <Dropdown
              className={baseStyles.select}
              fullWidth
              options={surveyFilterOptions}
              value={selectedTakeoutSurvey}
              onChange={setSelectedTakeoutSurvey}
            />
          </div>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label}>Function</label>
            <Dropdown
              className={baseStyles.select}
              fullWidth
              options={functionOptions}
              value={selectedFunctionId}
              onChange={setSelectedFunctionId}
            />
          </div>
        </div>

        <div className={styles.statsGrid}>
          <article className={styles.statCard}>
            <p className={styles.statTitle}>Total Rows</p>
            <p className={styles.statValue}>{formatNumber(takeoutStats.total)}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statTitle}>Takeout Rows</p>
            <p className={styles.statValue}>{formatNumber(takeoutStats.removed)}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statTitle}>Average Before</p>
            <p className={styles.statValue}>{toScore(takeoutStats.avgBefore)}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statTitle}>Average After</p>
            <p className={styles.statValue}>{toScore(takeoutStats.avgAfter)}</p>
          </article>
        </div>

        <p className={styles.tableNote}>Showing {takeoutRows.length} records</p>
        {takeoutLoading ? <p className={baseStyles.meta}>Memuat comparison takeout...</p> : null}

        <div className={baseStyles.tableWrap}>
          <table className={baseStyles.table}>
            <thead>
              <tr>
                <th scope="col">Survey</th>
                <th scope="col">Function</th>
                <th scope="col">Responden</th>
                <th scope="col">Aplikasi</th>
                <th scope="col">Question</th>
                <th scope="col" className={styles.scoreCenter}>Score Before</th>
                <th scope="col" className={styles.scoreCenter}>Takeout</th>
                <th scope="col" className={styles.scoreCenter}>Score After</th>
                <th scope="col">Alasan Takeout</th>
              </tr>
            </thead>
            <tbody>
              {takeoutRows.length === 0 ? (
                <tr>
                  <td colSpan={9}>Belum ada data takeout comparison</td>
                </tr>
              ) : (
                takeoutRows.map((row, index) => (
                  <tr key={`${row.surveyId}-${row.questionCode}-${index}`}>
                    <td>{row.surveyTitle}</td>
                    <td>{row.functionName}</td>
                    <td>{row.respondent}</td>
                    <td>{row.application}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.questionLink}
                        onClick={() => setModal({ type: "comment-detail", row })}
                      >
                        {row.questionCode}
                      </button>
                    </td>
                    <td className={styles.scoreCenter}>{toScore(row.scoreBefore)}</td>
                    <td className={styles.scoreCenter}>
                      {row.isTakeout ? (
                        <span className={styles.tagTakeout}>Takeout</span>
                      ) : (
                        <span className={styles.tagKeep}>Keep</span>
                      )}
                    </td>
                    <td className={styles.scoreCenter}>{toScore(row.scoreAfter)}</td>
                    <td className={!row.reason ? styles.mutedCell : undefined}>{row.reason || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal.type !== "none" ? (
        <div className={styles.modalOverlay} onClick={() => setModal({ type: "none" })}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="report-modal-title" onClick={(event) => event.stopPropagation()}>
            {modal.type === "confirm-generate" ? (
              <>
                <header className={styles.modalHeader}>
                  <h3 id="report-modal-title" className={styles.modalTitle}>Generate Report</h3>
                  <button type="button" className={styles.modalClose} onClick={() => setModal({ type: "none" })} aria-label="Tutup modal generate report">✕</button>
                </header>
                <div className={styles.modalBody}>
                  <p className={styles.modalText}>Generate report untuk &quot;{modal.survey.title}&quot; sekarang?</p>
                </div>
                <footer className={styles.modalActions}>
                  <button type="button" className={styles.buttonSecondaryXs} onClick={() => setModal({ type: "none" })}>Cancel</button>
                  <button type="button" className={styles.buttonPrimaryXs} onClick={() => void runGenerateReport(modal.survey)}>Generate</button>
                </footer>
              </>
            ) : null}

            {modal.type === "comment-detail" ? (
              <>
                <header className={styles.modalHeader}>
                  <h3 id="report-modal-title" className={styles.modalTitle}>Comment Detail {modal.row.questionCode}</h3>
                  <button type="button" className={styles.modalClose} onClick={() => setModal({ type: "none" })} aria-label="Tutup modal detail komentar">✕</button>
                </header>
                <div className={styles.modalBody}>
                  <p className={styles.modalText}><strong>Pertanyaan:</strong> {modal.row.questionText}</p>
                  <p className={styles.modalText}><strong>Alasan Takeout:</strong> {modal.row.reason || "-"}</p>
                </div>
                <footer className={styles.modalActions}>
                  <button type="button" className={styles.buttonSecondaryXs} onClick={() => setModal({ type: "none" })}>Close</button>
                </footer>
              </>
            ) : null}

            {modal.type === "export" ? (
              <>
                <header className={styles.modalHeader}>
                  <h3 id="report-modal-title" className={styles.modalTitle}>Export Report</h3>
                  <button type="button" className={styles.modalClose} onClick={() => setModal({ type: "none" })} aria-label="Tutup modal export report">✕</button>
                </header>
                <div className={styles.modalBody}>
                  <p className={styles.modalText}>Survey: {modal.survey.title}</p>
                  <label className={styles.fieldLabel} htmlFor="exportFormat">Export Format</label>
                  <Dropdown
                    className={styles.fieldControl}
                    fullWidth
                    options={exportFormatOptions}
                    value={modal.format}
                    onChange={(value) => setModal({ ...modal, format: value as "excel" | "pdf" })}
                  />
                  <p className={styles.modalHint}>
                    {modal.format === "pdf"
                      ? "PDF dibuka dari tampilan report yang sama, lalu disimpan melalui browser print."
                      : "Excel berisi sheet ringkasan report dan detail data respon."}
                  </p>
                </div>
                <footer className={styles.modalActions}>
                  <button type="button" className={styles.buttonSecondaryXs} onClick={() => setModal({ type: "none" })}>Cancel</button>
                  <button
                    type="button"
                    className={styles.buttonPrimaryXs}
                    onClick={() => void runExportReport(modal.survey, modal.format)}
                    disabled={exporting}
                  >
                    {exporting ? "Exporting..." : "Export"}
                  </button>
                </footer>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
