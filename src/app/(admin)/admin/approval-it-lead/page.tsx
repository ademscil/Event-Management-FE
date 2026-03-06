"use client";

import { getCurrentUser } from "@/lib/auth";
import { Dropdown } from "@/components/common/dropdown";
import {
  approveTakeout,
  fetchBestCommentsWithFeedback,
  fetchPendingApprovals,
  rejectTakeout,
  submitBestCommentFeedback,
  type BestCommentWithFeedback,
  type PendingApproval,
} from "@/lib/approvals";
import { fetchFunctionsMaster } from "@/lib/master-data";
import { fetchSurveyOverview } from "@/lib/surveys";
import type { UserRole } from "@/types/auth";
import { useEffect, useMemo, useState } from "react";
import baseStyles from "../page-mockup.module.css";
import styles from "../approval.module.css";

type Tab = "takeout" | "feedback";

function shortText(value?: string | null, max = 80): string {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function mapError(res: Array<{ success: boolean; message?: string }>): string {
  const firstFailed = res.find((item) => !item.success);
  if (!firstFailed) return "";
  return firstFailed.message || "Terjadi kesalahan saat proses approval";
}

export default function ApprovalItLeadPage() {
  const role: UserRole | null = getCurrentUser()?.role ?? null;
  const canAccess = role === "ITLead";

  const [tab, setTab] = useState<Tab>("takeout");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [surveyId, setSurveyId] = useState("");
  const [functionId, setFunctionId] = useState("all");
  const [surveys, setSurveys] = useState<Array<{ id: string; title: string }>>([]);
  const [functions, setFunctions] = useState<Array<{ id: string; name: string }>>([]);
  const [pendingRows, setPendingRows] = useState<PendingApproval[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<BestCommentWithFeedback[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const selectedRows = useMemo(
    () => pendingRows.filter((row) => selectedKeys.includes(`${row.ResponseId}-${row.QuestionId}`)),
    [pendingRows, selectedKeys]
  );
  const surveyDropdownOptions = useMemo(
    () => surveys.map((item) => ({ value: item.id, label: item.title })),
    [surveys]
  );
  const functionDropdownOptions = useMemo(
    () => [{ value: "all", label: "All Functions" }, ...functions.map((item) => ({ value: item.id, label: item.name }))],
    [functions]
  );

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
        setError("Gagal memuat data awal approval IT Lead.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const loadData = async () => {
    if (!surveyId) {
      setPendingRows([]);
      setFeedbackRows([]);
      return;
    }
    setError("");
    setMessage("");
    try {
      const [pendingRes, feedbackRes] = await Promise.all([
        fetchPendingApprovals({ surveyId, functionId: functionId === "all" ? undefined : functionId }),
        fetchBestCommentsWithFeedback({ surveyId, functionId: functionId === "all" ? undefined : functionId }),
      ]);

      if (!pendingRes.success) {
        setError(pendingRes.message);
        setPendingRows([]);
      } else {
        setPendingRows(pendingRes.data);
      }

      if (!feedbackRes.success) {
        setError((prev) => prev || feedbackRes.message);
        setFeedbackRows([]);
      } else {
        setFeedbackRows(feedbackRes.data);
        const map: Record<string, string> = {};
        feedbackRes.data.forEach((row) => {
          map[row.QuestionResponseId] = row.FeedbackText || "";
        });
        setFeedbackDraft(map);
      }
    } catch {
      setError("Terjadi kesalahan saat memuat data approval IT Lead.");
      setPendingRows([]);
      setFeedbackRows([]);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId, functionId]);

  const handleApprove = async () => {
    if (selectedRows.length === 0) {
      setError("Pilih minimal satu data untuk di-approve.");
      return;
    }
    const result = await Promise.all(
      selectedRows.map((row) =>
        approveTakeout({
          responseId: String(row.ResponseId),
          questionId: String(row.QuestionId),
        })
      )
    );
    const err = mapError(result);
    if (err) {
      setError(err);
      return;
    }
    setSelectedKeys([]);
    setMessage("Selected takeout berhasil di-approve.");
    await loadData();
  };

  const handleReject = async () => {
    if (selectedRows.length === 0) {
      setError("Pilih minimal satu data untuk di-reject.");
      return;
    }
    if (!rejectReason.trim()) {
      setError("Alasan reject wajib diisi.");
      return;
    }
    const result = await Promise.all(
      selectedRows.map((row) =>
        rejectTakeout({
          responseId: String(row.ResponseId),
          questionId: String(row.QuestionId),
          reason: rejectReason.trim(),
        })
      )
    );
    const err = mapError(result);
    if (err) {
      setError(err);
      return;
    }
    setRejectOpen(false);
    setRejectReason("");
    setSelectedKeys([]);
    setMessage("Selected takeout berhasil di-reject.");
    await loadData();
  };

  const handleSubmitFeedback = async (row: BestCommentWithFeedback) => {
    const text = String(feedbackDraft[row.QuestionResponseId] || "").trim();
    if (!text) {
      setError("Feedback tidak boleh kosong.");
      return;
    }
    const result = await submitBestCommentFeedback({
      questionResponseId: row.QuestionResponseId,
      feedbackText: text,
    });
    if (!result.success) {
      setError(result.message);
      return;
    }
    setMessage("Feedback berhasil disimpan.");
    await loadData();
  };

  if (!canAccess) {
    return (
      <section className={baseStyles.panel} aria-busy={loading}>
        <h1 className={baseStyles.title}>Akses Ditolak</h1>
        <p className={baseStyles.subtitle}>Halaman Approval IT Lead hanya untuk role IT Lead.</p>
      </section>
    );
  }

  return (
    <>
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Approval IT Lead</h1>
          <div className={baseStyles.subtitle}>Review score aplikasi dan feedback best comments.</div>
        </div>
      </div>

      <p className={styles.notice}>Skor aplikasi yang diusulkan takeout akan ditinjau oleh IT Lead sebelum finalisasi report.</p>

      <section className={baseStyles.panel}>
        <h2 className={baseStyles.panelTitle}>Filter</h2>
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
          <button type="button" className={`${styles.tabButton} ${tab === "takeout" ? styles.tabButtonActive : ""}`} onClick={() => setTab("takeout")}>
            Propose Takeout
          </button>
          <button type="button" className={`${styles.tabButton} ${tab === "feedback" ? styles.tabButtonActive : ""}`} onClick={() => setTab("feedback")}>
            Best Comments Feedback
          </button>
        </div>

        <div className={styles.statusRegion} aria-live="polite">
          {loading ? <p className={styles.meta}>Memuat data...</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          {message ? <p className={styles.success}>{message}</p> : null}
        </div>

        {tab === "takeout" ? (
          <>
            <div className={styles.toolbar}>
              <span className={styles.meta}>Showing {pendingRows.length} pending approvals</span>
              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} onClick={() => void handleApprove()} disabled={selectedRows.length === 0}>
                  Approve Selected
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => setRejectOpen(true)} disabled={selectedRows.length === 0}>
                  Reject Selected
                </button>
              </div>
            </div>

            {selectedRows.length > 0 ? <div className={styles.selectionHint}>Selected takeout items: {selectedRows.length}</div> : null}

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
                    <th scope="col">
                      <input
                        aria-label="Pilih semua pending takeout"
                        type="checkbox"
                        checked={selectedKeys.length > 0 && selectedKeys.length === pendingRows.length}
                        onChange={(event) =>
                          setSelectedKeys(event.target.checked ? pendingRows.map((row) => `${row.ResponseId}-${row.QuestionId}`) : [])
                        }
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.empty}>Tidak ada pending takeout untuk filter ini.</td>
                    </tr>
                  ) : (
                    pendingRows.map((row) => {
                      const key = `${row.ResponseId}-${row.QuestionId}`;
                      return (
                        <tr key={row.QuestionResponseId}>
                          <td>{row.RespondentName || "-"}</td>
                          <td>{row.DepartmentName || "-"}</td>
                          <td>{row.ApplicationName || "-"}</td>
                          <td>{row.QuestionText || "-"}</td>
                          <td className={styles.center}>{typeof row.NumericValue === "number" ? row.NumericValue : "-"}</td>
                          <td>{shortText(row.CommentValue)}</td>
                          <td>{shortText(row.TakeoutReason)}</td>
                          <td className={styles.center}>
                            <input
                              aria-label={`Pilih takeout ${row.QuestionResponseId}`}
                              type="checkbox"
                              checked={selectedKeys.includes(key)}
                              onChange={(event) =>
                                setSelectedKeys((prev) => {
                                  if (event.target.checked) return Array.from(new Set([...prev, key]));
                                  return prev.filter((item) => item !== key);
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
              <span className={styles.meta}>Showing {feedbackRows.length} best comments</span>
            </div>
            <div className={baseStyles.tableWrap}>
              <table className={baseStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Responden</th>
                    <th scope="col">Aplikasi</th>
                    <th scope="col">Pertanyaan</th>
                    <th scope="col">Komentar</th>
                    <th scope="col">Score</th>
                    <th scope="col">IT Lead Feedback</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.empty}>Belum ada best comments.</td>
                    </tr>
                  ) : (
                    feedbackRows.map((row) => (
                      <tr key={row.QuestionResponseId}>
                        <td>{row.RespondentName || "-"}</td>
                        <td>{row.ApplicationName || "-"}</td>
                        <td>{row.QuestionText || "-"}</td>
                        <td>{shortText(row.CommentValue)}</td>
                        <td className={styles.center}>{typeof row.NumericValue === "number" ? row.NumericValue : "-"}</td>
                        <td>
                          <textarea
                            className={styles.textarea}
                            rows={2}
                            aria-label={`Feedback IT Lead untuk ${row.QuestionResponseId}`}
                            value={feedbackDraft[row.QuestionResponseId] || ""}
                            onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, [row.QuestionResponseId]: event.target.value }))}
                          />
                        </td>
                        <td className={styles.center}>
                          <button type="button" className={styles.btnPrimary} onClick={() => void handleSubmitFeedback(row)}>
                            Submit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {rejectOpen ? (
        <div className={styles.modalOverlay} onClick={() => setRejectOpen(false)}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-label="Reject takeout" onClick={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Reject Selected Takeout</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setRejectOpen(false)} aria-label="Tutup modal reject takeout">
                x
              </button>
            </header>
            <div className={styles.modalBody}>
              <p className={styles.meta}>Jumlah item terpilih: {selectedRows.length}</p>
              <textarea
                className={styles.textarea}
                rows={4}
                placeholder="Alasan reject wajib diisi"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </div>
            <footer className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setRejectOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btnDanger} onClick={() => void handleReject()}>
                Reject
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

