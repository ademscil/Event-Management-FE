"use client";

import { getCurrentUser } from "@/lib/auth";
import { Dropdown } from "@/components/common/dropdown";
import { fetchFunctionsMaster } from "@/lib/master-data";
import {
  exportSurveyReport,
  fetchReportSelectionList,
  fetchTakeoutComparison,
  generateSurveyReport,
  type ReportSelectionItem,
  type TakeoutComparisonRow,
} from "@/lib/reports";
import type { UserRole } from "@/types/auth";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import baseStyles from "../page-mockup.module.css";
import styles from "./report.module.css";

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
  | { type: "export"; survey: ReportSelectionItem; format: "excel" | "csv" | "pdf" };

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toFixed(2);
}

function mapSelectionStatus(item: ReportSelectionItem): "generated" | "active" | "draft" | "closed" | "archived" | "other" {
  if (item.hasGeneratedReport) return "generated";
  const normalized = String(item.status || "").toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "draft") return "draft";
  if (normalized === "closed") return "closed";
  if (normalized === "archived") return "archived";
  return "other";
}

export default function ReportSelectionPage() {
  const searchParams = useSearchParams();
  const preselectedSurveyId = String(searchParams.get("surveyId") || "");

  const currentUser = getCurrentUser();
  const role: UserRole | null = currentUser?.role ?? null;
  const isAdminEvent = role === "AdminEvent";
  const isDepartmentHead = role === "DepartmentHead";
  const canAccess = isAdminEvent || isDepartmentHead;

  const [surveys, setSurveys] = useState<ReportSelectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [surveySearch, setSurveySearch] = useState("");
  const [selectedTakeoutSurvey, setSelectedTakeoutSurvey] = useState<string>(preselectedSurveyId || "all");
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>("all");
  const [functionOptions, setFunctionOptions] = useState<Array<{ value: string; label: string }>>([{ value: "all", label: "All Functions" }]);

  const [takeoutRows, setTakeoutRows] = useState<TakeoutTableRow[]>([]);
  const [takeoutLoading, setTakeoutLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const run = async () => {
      const [listResult, functionResult] = await Promise.all([
        fetchReportSelectionList(),
        fetchFunctionsMaster(),
      ]);

      setLoading(false);

      if (!listResult.success) {
        setError(listResult.message || "Gagal memuat daftar event report");
        setSurveys([]);
      } else {
        setError("");
        setSurveys(listResult.surveys);
      }

      if (functionResult.success) {
        const dynamic = functionResult.data
          .filter((item) => item.IsActive !== false)
          .map((item) => ({ value: item.FunctionId, label: item.Name }));
        setFunctionOptions([{ value: "all", label: "All Functions" }, ...dynamic]);
      }
    };
    void run();
  }, []);

  const filteredSurveyRows = useMemo(() => {
    const term = surveySearch.trim().toLowerCase();
    if (!term) return surveys;
    return surveys.filter((item) => {
      const name = String(item.title || "").toLowerCase();
      const period = String(item.period || "").toLowerCase();
      return name.includes(term) || period.includes(term);
    });
  }, [surveySearch, surveys]);

  const lastUpdatedText = useMemo(() => {
    if (surveys.length === 0) return "-";
    return formatDate(new Date().toISOString());
  }, [surveys.length]);

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
      { value: "csv", label: "CSV (.csv)" },
      { value: "pdf", label: "PDF (.pdf)" },
    ],
    []
  );

  const loadTakeoutRows = async () => {
    setTakeoutLoading(true);
    setError("");
    setMessage("");

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

    for (const survey of surveyTargets) {
      const result = await fetchTakeoutComparison({ surveyId: survey.surveyId, functionId });
      if (!result.success) {
        setError(result.message || "Gagal memuat comparison takeout");
        setTakeoutLoading(false);
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

    setTakeoutRows(allRows);
    setTakeoutLoading(false);
  };

  useEffect(() => {
    if (!loading) {
      void loadTakeoutRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, selectedTakeoutSurvey, selectedFunctionId, surveys.length]);

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

    setSurveys((prev) => prev.map((item) => (item.surveyId === survey.surveyId ? { ...item, hasGeneratedReport: true } : item)));
    setMessage(`Report untuk "${survey.title}" berhasil di-generate.`);
  };

  const runExportReport = async (survey: ReportSelectionItem, format: "excel" | "csv" | "pdf") => {
    if (format === "csv") {
      setError("Export CSV belum tersedia. Gunakan Excel atau PDF.");
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
          <div className={baseStyles.subtitle}>{isDepartmentHead ? "Pilih survey untuk melihat laporan (readonly)." : "Pilih event untuk melihat laporan."}</div>
        </div>
      </div>

      <section className={baseStyles.panel}>
        <div className={baseStyles.panelHeader}>
          <h2 className={baseStyles.panelTitle}>Daftar Event</h2>
          <span className={baseStyles.meta}>Terakhir diperbarui: {lastUpdatedText}</span>
        </div>
        <div className={styles.searchInlineRow}>
          <label className={styles.searchInlineLabel} htmlFor="surveySearch">CARI EVENT</label>
          <span className={styles.searchInlineColon}>:</span>
          <input
            id="surveySearch"
            className={`${baseStyles.input} ${styles.searchInlineInput}`}
            placeholder="Nama event atau periode"
            value={surveySearch}
            onChange={(event) => setSurveySearch(event.target.value)}
          />
        </div>

        {loading ? <p className={baseStyles.meta}>Memuat event report...</p> : null}
        {error ? <p className={baseStyles.meta}>{error}</p> : null}
        {message ? <p className={baseStyles.meta}>{message}</p> : null}

        <div className={baseStyles.tableWrap}>
          <table className={baseStyles.table}>
            <thead>
              <tr>
                <th>Nama Event</th>
                <th>Periode</th>
                <th>Status</th>
                <th>Responden</th>
                <th>Aksi</th>
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
                  return (
                    <tr key={item.surveyId}>
                      <td>{item.title}</td>
                      <td>{item.period || "-"}</td>
                      <td>
                        {mappedStatus === "generated" ? (
                          <span className={`${baseStyles.badge} ${styles.badgeGenerated}`}>Generated</span>
                        ) : (
                          <span className={styles.statusText}>{item.status}</span>
                        )}
                      </td>
                      <td>{formatNumber(item.respondentCount)}</td>
                      <td>
                        <div className={styles.actions}>
                          {isDepartmentHead ? (
                            <button
                              type="button"
                              className={styles.buttonSecondaryXs}
                              onClick={() => {
                                setSelectedTakeoutSurvey(item.surveyId);
                                setMessage(`Viewing report "${item.title}".`);
                              }}
                            >
                              View Report
                            </button>
                          ) : (
                            <>
                              {item.hasGeneratedReport ? (
                                <button
                                  type="button"
                                  className={styles.buttonSecondaryXs}
                                  onClick={() => {
                                    setSelectedTakeoutSurvey(item.surveyId);
                                    setMessage(`Viewing report "${item.title}".`);
                                  }}
                                >
                                  View Report
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.buttonPrimaryXs}
                                  onClick={() => setModal({ type: "confirm-generate", survey: item })}
                                >
                                  Generate Report
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.buttonGhostXs}
                                onClick={() => setModal({ type: "export", survey: item, format: "excel" })}
                              >
                                Export
                              </button>
                            </>
                          )}
                        </div>
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
        <div className={baseStyles.filterGrid}>
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
                <th>Survey</th>
                <th>Function</th>
                <th>Responden</th>
                <th>Aplikasi</th>
                <th>Question</th>
                <th className={styles.scoreCenter}>Score Before</th>
                <th className={styles.scoreCenter}>Takeout</th>
                <th className={styles.scoreCenter}>Score After</th>
                <th>Alasan Takeout</th>
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
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            {modal.type === "confirm-generate" ? (
              <>
                <header className={styles.modalHeader}>
                  <h3 className={styles.modalTitle}>Generate Report</h3>
                  <button type="button" className={styles.modalClose} onClick={() => setModal({ type: "none" })}>x</button>
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
                  <h3 className={styles.modalTitle}>Comment Detail {modal.row.questionCode}</h3>
                  <button type="button" className={styles.modalClose} onClick={() => setModal({ type: "none" })}>x</button>
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
                  <h3 className={styles.modalTitle}>Export Report</h3>
                  <button type="button" className={styles.modalClose} onClick={() => setModal({ type: "none" })}>x</button>
                </header>
                <div className={styles.modalBody}>
                  <p className={styles.modalText}>Survey: {modal.survey.title}</p>
                  <label className={styles.fieldLabel} htmlFor="exportFormat">Export Format</label>
                  <Dropdown
                    className={styles.fieldControl}
                    fullWidth
                    options={exportFormatOptions}
                    value={modal.format}
                    onChange={(value) => setModal({ ...modal, format: value as "excel" | "csv" | "pdf" })}
                  />
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
