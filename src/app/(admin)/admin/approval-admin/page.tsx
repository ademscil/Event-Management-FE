"use client";

import { getCurrentUser } from "@/lib/auth";
import { fetchApprovalRespondents, fetchProposedTakeouts, type ApprovalRespondent, type ApprovalTakeout } from "@/lib/approvals";
import { Dropdown } from "@/components/common/dropdown";
import { fetchFunctionsMaster } from "@/lib/master-data";
import { fetchSurveyOverview } from "@/lib/surveys";
import type { UserRole } from "@/types/auth";
import { useEffect, useMemo, useState } from "react";
import baseStyles from "../page-mockup.module.css";
import styles from "../approval.module.css";

type Tab = "respondents" | "takeout";
type ModalState = { type: "none" } | { type: "detail"; row: ApprovalRespondent };

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toCsvValue(value: string | number | boolean | null | undefined): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function ApprovalAdminPage() {
  const role: UserRole | null = getCurrentUser()?.role ?? null;
  const canAccess = role === "AdminEvent";

  const [tab, setTab] = useState<Tab>("respondents");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [surveyId, setSurveyId] = useState("");
  const [functionId, setFunctionId] = useState("all");
  const [duplicateFilter, setDuplicateFilter] = useState<"all" | "duplicate" | "unique">("all");

  const [surveys, setSurveys] = useState<Array<{ id: string; title: string }>>([]);
  const [functions, setFunctions] = useState<Array<{ id: string; name: string }>>([]);
  const [respondents, setRespondents] = useState<ApprovalRespondent[]>([]);
  const [takeouts, setTakeouts] = useState<ApprovalTakeout[]>([]);
  const [selectedRespondentIds, setSelectedRespondentIds] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  useEffect(() => {
    const run = async () => {
      try {
        const [surveyRes, functionRes] = await Promise.all([fetchSurveyOverview(), fetchFunctionsMaster()]);
        if (!surveyRes.success) {
          setLoading(false);
          setError(surveyRes.message || "Gagal memuat survey");
          return;
        }

        const surveyOptions = surveyRes.surveys.map((item) => ({ id: item.SurveyId, title: item.Title }));
        setSurveys(surveyOptions);
        setSurveyId(surveyOptions[0]?.id || "");

        if (functionRes.success) {
          setFunctions(functionRes.data.filter((item) => item.IsActive !== false).map((item) => ({ id: item.FunctionId, name: item.Name })));
        }
      } catch {
        setError("Gagal memuat data awal halaman approval.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (!surveyId) {
      setRespondents([]);
      setTakeouts([]);
      return;
    }
    const run = async () => {
      setError("");
      setMessage("");
      try {
        const [respondentRes, takeoutRes] = await Promise.all([
          fetchApprovalRespondents({ surveyId, duplicateFilter }),
          fetchProposedTakeouts({ surveyId, functionId: functionId === "all" ? undefined : functionId }),
        ]);

        if (!respondentRes.success) {
          setError(respondentRes.message);
          setRespondents([]);
        } else {
          setRespondents(respondentRes.data);
        }

        if (!takeoutRes.success) {
          setError((prev) => prev || takeoutRes.message);
          setTakeouts([]);
        } else {
          setTakeouts(takeoutRes.data);
        }
      } catch {
        setError("Terjadi kesalahan saat memuat data approval.");
        setRespondents([]);
        setTakeouts([]);
      }
    };
    void run();
  }, [surveyId, duplicateFilter, functionId]);

  const duplicateCount = useMemo(() => respondents.filter((item) => item.IsDuplicate).length, [respondents]);
  const surveyDropdownOptions = useMemo(
    () => surveys.map((item) => ({ value: item.id, label: item.title })),
    [surveys]
  );
  const functionDropdownOptions = useMemo(
    () => [{ value: "all", label: "All Functions" }, ...functions.map((item) => ({ value: item.id, label: item.name }))],
    [functions]
  );
  const duplicateDropdownOptions = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "duplicate", label: "Duplicate Only" },
      { value: "unique", label: "Unique Only" },
    ],
    []
  );

  const handleExportRespondents = () => {
    if (respondents.length === 0) {
      setError("Belum ada data responden untuk diexport.");
      return;
    }

    const headers = ["Respondent", "Department", "Application", "Email", "Submit Time", "Duplicate Status"];
    const rows = respondents.map((row) => [
      row.RespondentName || "",
      row.DepartmentName || "",
      row.ApplicationName || "",
      row.RespondentEmail || "",
      formatDateTime(row.SubmittedAt),
      row.IsDuplicate ? "Duplicate" : "Unique",
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => toCsvValue(cell)).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `approval-admin-respondents-${surveyId || "survey"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!canAccess) {
    return (
      <section className={baseStyles.panel} aria-busy={loading}>
        <h1 className={baseStyles.title}>Akses Ditolak</h1>
        <p className={baseStyles.subtitle}>Halaman Approval Admin hanya untuk Admin Event.</p>
      </section>
    );
  }

  return (
    <>
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Approval Admin</h1>
          <div className={baseStyles.subtitle}>Final review untuk data responden dan usulan takeout.</div>
        </div>
      </div>

      <p className={styles.notice}>Review responden duplicate dan monitor usulan takeout sebelum tahap Approval IT Lead.</p>

      <section className={baseStyles.panel}>
        <div className={baseStyles.filterGrid}>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label} htmlFor="survey">Survey</label>
            <Dropdown
              className={baseStyles.select}
              fullWidth
              options={surveyDropdownOptions}
              value={surveyId}
              onChange={setSurveyId}
              placeholder="Pilih survey"
            />
          </div>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label} htmlFor="function">Function</label>
            <Dropdown
              className={baseStyles.select}
              fullWidth
              options={functionDropdownOptions}
              value={functionId}
              onChange={setFunctionId}
            />
          </div>
        </div>
      </section>

      <section className={baseStyles.panel}>
        <div className={baseStyles.panelHeader}>
          <div>
            <h2 className={baseStyles.panelTitle}>Survey Data Review</h2>
            <p className={baseStyles.meta}>Review responden dan duplicate check sebelum lanjut ke Approval IT Lead.</p>
          </div>
        </div>

        <div className={styles.tabs}>
          <button type="button" className={`${styles.tabButton} ${tab === "respondents" ? styles.tabButtonActive : ""}`} onClick={() => setTab("respondents")}>
            Daftar Responden
          </button>
          <button type="button" className={`${styles.tabButton} ${tab === "takeout" ? styles.tabButtonActive : ""}`} onClick={() => setTab("takeout")}>
            Propose Takeout
          </button>
        </div>

        <div className={styles.statusRegion} aria-live="polite">
          {loading ? <p className={styles.meta}>Memuat data...</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          {message ? <p className={styles.success}>{message}</p> : null}
        </div>

        {tab === "respondents" ? (
          <>
            <div className={styles.toolbar}>
              <span className={styles.meta}>
                Showing {respondents.length} respondents ({duplicateCount} duplicate)
              </span>
              <div className={styles.actions}>
                <Dropdown
                  className={baseStyles.select}
                  options={duplicateDropdownOptions}
                  value={duplicateFilter}
                  onChange={(value) => setDuplicateFilter(value as "all" | "duplicate" | "unique")}
                />
                <button type="button" className={styles.btnSecondary} onClick={handleExportRespondents} disabled={respondents.length === 0}>
                  Export to CSV
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => setSelectedRespondentIds([])} disabled={selectedRespondentIds.length === 0}>
                  Clear Selection
                </button>
              </div>
            </div>

            {selectedRespondentIds.length > 0 ? <div className={styles.selectionHint}>Selected respondents: {selectedRespondentIds.length}</div> : null}

            <div className={baseStyles.tableWrap}>
              <table className={baseStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Responden</th>
                    <th scope="col">Department</th>
                    <th scope="col">Aplikasi</th>
                    <th scope="col">Email</th>
                    <th scope="col">Submit Time</th>
                    <th scope="col">Duplicate</th>
                    <th scope="col">Action</th>
                    <th scope="col">
                      <input
                        aria-label="Pilih semua responden"
                        type="checkbox"
                        checked={selectedRespondentIds.length > 0 && selectedRespondentIds.length === respondents.length}
                        onChange={(event) =>
                          setSelectedRespondentIds(event.target.checked ? respondents.map((item) => item.ResponseId) : [])
                        }
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {respondents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.empty}>Belum ada data responden.</td>
                    </tr>
                  ) : (
                    respondents.map((row) => {
                      const selected = selectedRespondentIds.includes(row.ResponseId);
                      return (
                        <tr key={row.ResponseId}>
                          <td>{row.RespondentName || "-"}</td>
                          <td>{row.DepartmentName || "-"}</td>
                          <td>{row.ApplicationName || "-"}</td>
                          <td>{row.RespondentEmail || "-"}</td>
                          <td>{formatDateTime(row.SubmittedAt)}</td>
                          <td className={styles.center}>
                            <span className={`${styles.pill} ${row.IsDuplicate ? styles.pillDuplicate : styles.pillUnique}`}>
                              {row.IsDuplicate ? "Duplicate" : "Unique"}
                            </span>
                          </td>
                          <td className={styles.center}>
                            <button type="button" className={styles.link} onClick={() => setModal({ type: "detail", row })}>
                              View
                            </button>
                          </td>
                          <td className={styles.center}>
                            <input
                              aria-label={`Pilih responden ${row.RespondentName || row.RespondentEmail || row.ResponseId}`}
                              type="checkbox"
                              checked={selected}
                              onChange={(event) =>
                                setSelectedRespondentIds((prev) => {
                                  if (event.target.checked) {
                                    return Array.from(new Set([...prev, row.ResponseId]));
                                  }
                                  return prev.filter((id) => id !== row.ResponseId);
                                })
                              }
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className={styles.toolbar}>
              <span className={styles.meta}>Showing {takeouts.length} proposed takeouts</span>
              <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setMessage("Approval dilakukan di halaman Approval IT Lead.")}>
                  Informasi Alur
                </button>
              </div>
            </div>

            <div className={baseStyles.tableWrap}>
              <table className={baseStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Responden</th>
                    <th scope="col">Department</th>
                    <th scope="col">Aplikasi</th>
                    <th scope="col">Pertanyaan</th>
                    <th scope="col">Score</th>
                    <th scope="col">Komentar</th>
                    <th scope="col">Alasan Takeout</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {takeouts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.empty}>Belum ada proposed takeout.</td>
                    </tr>
                  ) : (
                    takeouts.map((row) => (
                      <tr key={row.QuestionResponseId}>
                        <td>{row.RespondentName || "-"}</td>
                        <td>{row.DepartmentName || "-"}</td>
                        <td>{row.ApplicationName || "-"}</td>
                        <td>{row.QuestionText || "-"}</td>
                        <td className={styles.center}>{typeof row.NumericValue === "number" ? row.NumericValue : "-"}</td>
                        <td>{row.CommentValue || "-"}</td>
                        <td>{row.TakeoutReason || "-"}</td>
                        <td className={styles.center}>{row.TakeoutStatus || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {modal.type !== "none" ? (
        <div className={styles.modalOverlay} onClick={() => setModal({ type: "none" })}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-label="Detail responden" onClick={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Detail Responden</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setModal({ type: "none" })} aria-label="Tutup modal detail responden">
                x
              </button>
            </header>
            <div className={styles.modalBody}>
              <p><strong>Nama:</strong> {modal.row.RespondentName || "-"}</p>
              <p><strong>Email:</strong> {modal.row.RespondentEmail || "-"}</p>
              <p><strong>Department:</strong> {modal.row.DepartmentName || "-"}</p>
              <p><strong>Aplikasi:</strong> {modal.row.ApplicationName || "-"}</p>
              <p><strong>Submitted:</strong> {formatDateTime(modal.row.SubmittedAt)}</p>
              <p><strong>Duplicate Count:</strong> {modal.row.DuplicateCount || 1}</p>
            </div>
            <footer className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setModal({ type: "none" })}>
                Close
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

