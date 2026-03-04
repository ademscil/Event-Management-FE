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
      setLoading(false);
    };
    void run();
  }, []);

  useEffect(() => {
    if (!surveyId) return;
    const run = async () => {
      setError("");
      setMessage("");
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

  if (!canAccess) {
    return (
      <section className={baseStyles.panel}>
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
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tabButton} ${tab === "respondents" ? styles.tabButtonActive : ""}`} onClick={() => setTab("respondents")}>
            Daftar Responden
          </button>
          <button type="button" className={`${styles.tabButton} ${tab === "takeout" ? styles.tabButtonActive : ""}`} onClick={() => setTab("takeout")}>
            Propose Takeout
          </button>
        </div>

        {loading ? <p className={styles.meta}>Memuat data...</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        {message ? <p className={styles.success}>{message}</p> : null}

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
                <button type="button" className={styles.btnGhost} onClick={() => setSelectedRespondentIds([])}>
                  Clear Selection
                </button>
              </div>
            </div>

            <div className={baseStyles.tableWrap}>
              <table className={baseStyles.table}>
                <thead>
                  <tr>
                    <th>Responden</th>
                    <th>Department</th>
                    <th>Aplikasi</th>
                    <th>Email</th>
                    <th>Submit Time</th>
                    <th>Duplicate</th>
                    <th>Action</th>
                    <th>
                      <input
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
                              type="checkbox"
                              checked={selected}
                              onChange={(event) =>
                                setSelectedRespondentIds((prev) =>
                                  event.target.checked ? [...prev, row.ResponseId] : prev.filter((id) => id !== row.ResponseId)
                                )
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
                    <th>Responden</th>
                    <th>Department</th>
                    <th>Aplikasi</th>
                    <th>Pertanyaan</th>
                    <th>Score</th>
                    <th>Komentar</th>
                    <th>Alasan Takeout</th>
                    <th>Status</th>
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
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Detail Responden</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setModal({ type: "none" })}>
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
