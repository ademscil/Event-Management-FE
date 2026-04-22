"use client";

import { getCurrentUser } from "@/lib/auth";
import { Dropdown } from "@/components/common/dropdown";
import {
  fetchBestCommentsWithFeedback,
  fetchCommentsForSelection,
  markBestComment,
  unmarkBestComment,
  type ApprovalComment,
  type BestCommentWithFeedback,
} from "@/lib/approvals";
import { fetchFunctionsMaster } from "@/lib/master-data";
import { fetchSurveyOverview } from "@/lib/surveys";
import type { UserRole } from "@/types/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import baseStyles from "../page-mockup.module.css";
import styles from "../approval.module.css";

type Tab = "comments" | "best-comments";
type ModalState =
  | { type: "none" }
  | { type: "detail"; row: { question: string; comment: string } };

function shortText(value?: string | null, max = 72): string {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function getCommentSelectionAriaLabel(row: ApprovalComment): string {
  const question = String(row.QuestionText || "").trim();
  const application = String(row.ApplicationName || "").trim();
  if (question && application) return `Pilih komentar ${question} - ${application}`;
  if (question) return `Pilih komentar ${question}`;
  if (application) return `Pilih komentar ${application}`;
  return "Pilih komentar";
}

export default function BestCommentsPage() {
  const role: UserRole | null = getCurrentUser()?.role ?? null;
  const canAccess = role === "AdminEvent" || role === "DepartmentHead";
  const canEdit = role === "AdminEvent";

  const [tab, setTab] = useState<Tab>("comments");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [surveyId, setSurveyId] = useState("all");
  const [functionId, setFunctionId] = useState("all");
  const [surveys, setSurveys] = useState<Array<{ id: string; title: string }>>([]);
  const [functions, setFunctions] = useState<Array<{ id: string; name: string }>>([]);
  const [comments, setComments] = useState<ApprovalComment[]>([]);
  const [bestRows, setBestRows] = useState<BestCommentWithFeedback[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
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
        setSurveys(surveyRes.surveys.map((item) => ({ id: item.SurveyId, title: item.Title })));
        if (functionRes.success) {
          setFunctions(functionRes.data.filter((item) => item.IsActive !== false).map((item) => ({ id: item.FunctionId, name: item.Name })));
        }
      } catch {
        setError("Gagal memuat data awal best comments.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const loadData = useCallback(async () => {
    const selectedSurvey = surveyId === "all" ? undefined : surveyId;
    const selectedFunction = functionId === "all" ? undefined : functionId;
    try {
      const [commentRes, bestRes] = await Promise.all([
        fetchCommentsForSelection({ surveyId: selectedSurvey, functionId: selectedFunction }),
        fetchBestCommentsWithFeedback({ surveyId: selectedSurvey, functionId: selectedFunction }),
      ]);

      if (!commentRes.success) {
        setError(commentRes.message);
        setComments([]);
      } else {
        setComments(commentRes.data);
      }

      if (!bestRes.success) {
        setError((prev) => prev || bestRes.message);
        setBestRows([]);
      } else {
        setBestRows(bestRes.data);
      }
    } catch {
      setError("Terjadi kesalahan saat memuat data best comments.");
      setComments([]);
      setBestRows([]);
    }
  }, [surveyId, functionId]);

  useEffect(() => {
    setError("");
    setMessage("");
    void loadData();
  }, [loadData]);

  const selectedRows = useMemo(
    () => comments.filter((row) => selectedKeys.includes(`${row.ResponseId}-${row.QuestionId}`)),
    [comments, selectedKeys]
  );
  const surveyDropdownOptions = useMemo(
    () => [{ value: "all", label: "All Surveys" }, ...surveys.map((item) => ({ value: item.id, label: item.title }))],
    [surveys]
  );
  const functionDropdownOptions = useMemo(
    () => [{ value: "all", label: "All Functions" }, ...functions.map((item) => ({ value: item.id, label: item.name }))],
    [functions]
  );

  const saveBestComments = async () => {
    if (selectedRows.length === 0) {
      setError("Pilih minimal satu komentar.");
      return;
    }
    const responses = await Promise.all(
      selectedRows.map((row) =>
        markBestComment({
          responseId: String(row.ResponseId),
          questionId: String(row.QuestionId),
        })
      )
    );
    const firstFailed = responses.find((item) => !item.success);
    if (firstFailed && !firstFailed.success) {
      setError(firstFailed.message);
      return;
    }
    setMessage("Best comments berhasil disimpan.");
    setSelectedKeys([]);
    await loadData();
  };

  const removeBestComment = async (row: ApprovalComment) => {
    const result = await unmarkBestComment({
      responseId: String(row.ResponseId),
      questionId: String(row.QuestionId),
    });
    if (!result.success) {
      setError(result.message);
      return;
    }
    setMessage("Best comment berhasil dihapus.");
    await loadData();
  };

  if (!canAccess) {
    return (
      <section className={baseStyles.panel}>
        <h1 className={baseStyles.title}>Akses Ditolak</h1>
        <p className={baseStyles.subtitle}>Role Anda tidak memiliki akses ke halaman Best Comments.</p>
      </section>
    );
  }

  return (
    <>
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Best Comments Management</h1>
          <div className={baseStyles.subtitle}>
            {canEdit ? "Kelola komentar terbaik dari responden survey." : "Lihat komentar terbaik survey (readonly)."}
          </div>
        </div>
      </div>

      <section className={baseStyles.panel} aria-busy={loading}>
        <h2 className={baseStyles.panelTitle}>Filter</h2>
        <div className={baseStyles.filterGrid}>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label}>Survey</label>
            <Dropdown
              className={baseStyles.select}
              fullWidth
              options={surveyDropdownOptions}
              value={surveyId}
              onChange={setSurveyId}
              aria-label="Pilih survey"
            />
          </div>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label}>Function</label>
            <Dropdown
              className={baseStyles.select}
              fullWidth
              options={functionDropdownOptions}
              value={functionId}
              onChange={setFunctionId}
              aria-label="Filter function"
            />
          </div>
        </div>
      </section>

      <section className={baseStyles.panel}>
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tabButton} ${tab === "comments" ? styles.tabButtonActive : ""}`} onClick={() => setTab("comments")}>
            View Comments
          </button>
          <button type="button" className={`${styles.tabButton} ${tab === "best-comments" ? styles.tabButtonActive : ""}`} onClick={() => setTab("best-comments")}>
            View Best Comments
          </button>
        </div>

        <div className={styles.statusRegion} aria-live="polite">
          {loading ? <p className={styles.meta}>Memuat data...</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          {message ? <p className={styles.success}>{message}</p> : null}
        </div>

        {tab === "comments" ? (
          <>
            <div className={styles.toolbar}>
              <span className={styles.meta}>Showing {comments.length} comments</span>
              {canEdit ? (
                <div className={styles.actions}>
                  <button type="button" className={styles.btnPrimary} onClick={() => void saveBestComments()} disabled={selectedRows.length === 0}>
                    Save Best Comments
                  </button>
                  <button type="button" className={styles.btnSecondary} onClick={() => setSelectedKeys([])} disabled={selectedKeys.length === 0}>
                    Clear Selection
                  </button>
                </div>
              ) : null}
            </div>

            {canEdit && selectedRows.length > 0 ? <div className={styles.selectionHint}>Selected comments: {selectedRows.length}</div> : null}
            {!canEdit ? <div className={styles.readonlyHint}>Role Department Head hanya dapat melihat best comments dan feedback yang sudah dipilih.</div> : null}

            <div className={baseStyles.tableWrap}>
              <table className={baseStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">
                      {canEdit ? (
                        <input
                          type="checkbox"
                          checked={selectedKeys.length > 0 && selectedKeys.length === comments.length}
                          aria-label="Pilih semua komentar"
                          onChange={(event) =>
                            setSelectedKeys(event.target.checked ? comments.map((row) => `${row.ResponseId}-${row.QuestionId}`) : [])
                          }
                        />
                      ) : (
                        "Status"
                      )}
                    </th>
                    <th scope="col">Responden</th>
                    <th scope="col">Aplikasi</th>
                    <th scope="col">Pertanyaan</th>
                    <th scope="col">Komentar</th>
                    <th scope="col">Score</th>
                    {canEdit ? <th scope="col">Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {comments.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 7 : 6} className={styles.empty}>Belum ada komentar.</td>
                    </tr>
                  ) : (
                    comments.map((row) => {
                      const key = `${row.ResponseId}-${row.QuestionId}`;
                      const selected = selectedKeys.includes(key);
                      return (
                        <tr key={row.QuestionResponseId}>
                          <td className={styles.center}>
                            {canEdit ? (
                              <input
                                type="checkbox"
                                checked={selected}
                                aria-label={getCommentSelectionAriaLabel(row)}
                                onChange={(event) =>
                                  setSelectedKeys((prev) => {
                                    if (event.target.checked) return Array.from(new Set([...prev, key]));
                                    return prev.filter((item) => item !== key);
                                  })
                                }
                              />
                            ) : (
                              <span className={`${styles.pill} ${row.IsBestComment ? styles.pillBest : styles.pillNo}`}>
                                {row.IsBestComment ? "Best" : "Normal"}
                              </span>
                            )}
                          </td>
                          <td>{row.RespondentName || "-"}</td>
                          <td>{row.ApplicationName || "-"}</td>
                          <td>{row.QuestionText || "-"}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() =>
                                setModal({
                                  type: "detail",
                                  row: { question: row.QuestionText || "-", comment: row.CommentValue || "-" },
                                })
                              }
                            >
                              {shortText(row.CommentValue)}
                            </button>
                          </td>
                          <td className={styles.center}>{typeof row.NumericValue === "number" ? row.NumericValue : "-"}</td>
                          {canEdit ? (
                            <td className={styles.center}>
                              {row.IsBestComment ? (
                                <button type="button" className={styles.btnGhost} onClick={() => void removeBestComment(row)}>
                                  Unmark
                                </button>
                              ) : (
                                <span className={styles.meta}>-</span>
                              )}
                            </td>
                          ) : null}
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
              <span className={styles.meta}>Showing {bestRows.length} best comments</span>
            </div>
            <div className={baseStyles.tableWrap}>
              <table className={baseStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Survey</th>
                    <th scope="col">Function</th>
                    <th scope="col">IT Lead</th>
                    <th scope="col">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {bestRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={styles.empty}>Belum ada data best comments feedback.</td>
                    </tr>
                  ) : (
                    bestRows.map((row) => (
                      <tr key={row.QuestionResponseId}>
                        <td>{row.SurveyTitle || "-"}</td>
                        <td>{row.FunctionName || "-"}</td>
                        <td>{row.ITLeadName || "-"}</td>
                        <td>{row.FeedbackText || "-"}</td>
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
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="best-comments-modal-title" onClick={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h2 id="best-comments-modal-title" className={styles.modalTitle}>Comment Detail</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setModal({ type: "none" })} aria-label="Tutup modal detail komentar">
                x
              </button>
            </header>
            <div className={styles.modalBody}>
              <p><strong>Pertanyaan:</strong> {modal.row.question}</p>
              <p><strong>Jawaban Responden:</strong> {modal.row.comment}</p>
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

