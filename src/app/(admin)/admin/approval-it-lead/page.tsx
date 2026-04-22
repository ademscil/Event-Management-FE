"use client";

import { getCurrentUser } from "@/lib/auth";
import { Dropdown } from "@/components/common/dropdown";
import {
  approveFinalResponses,
  fetchBestCommentsWithFeedback,
  fetchPendingApprovals,
  proposeTakeout,
  submitBestCommentFeedback,
  type BestCommentWithFeedback,
  type PendingApproval,
} from "@/lib/approvals";
import { fetchSurveyOverview } from "@/lib/surveys";
import type { UserRole } from "@/types/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import baseStyles from "../page-mockup.module.css";
import styles from "../approval.module.css";
import ApprovalItLeadDialogs from "./approval-it-lead-dialogs";
import { getFeedbackAriaLabel, getPendingReviewAriaLabel, mapError, shortText } from "./approval-it-lead-utils";

type Tab = "takeout" | "feedback";

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
  const [pendingRows, setPendingRows] = useState<PendingApproval[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<BestCommentWithFeedback[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeReason, setProposeReason] = useState("");

  const selectedRows = useMemo(
    () => pendingRows.filter((row) => selectedKeys.includes(`${row.ResponseId}-${row.QuestionId}`)),
    [pendingRows, selectedKeys]
  );
  const surveyDropdownOptions = useMemo(
    () => surveys.map((item) => ({ value: item.id, label: item.title })),
    [surveys]
  );
  const derivedFunctions = useMemo(() => {
    const map = new Map<string, string>();
    [...pendingRows, ...feedbackRows].forEach((item) => {
      if (item.FunctionId && item.FunctionName) {
        map.set(String(item.FunctionId), String(item.FunctionName));
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pendingRows, feedbackRows]);
  const functionDropdownOptions = useMemo(
    () => [{ value: "all", label: "All Functions" }, ...derivedFunctions.map((item) => ({ value: item.id, label: item.name }))],
    [derivedFunctions]
  );

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const surveyRes = await fetchSurveyOverview();
        if (!active) return;

        if (!surveyRes.success) {
          setError(surveyRes.message || "Gagal memuat survey");
          setSurveys([]);
          setSurveyId("");
          return;
        }

        const surveyOptions = surveyRes.surveys.map((item) => ({ id: item.SurveyId, title: item.Title }));
        setSurveys(surveyOptions);
        setSurveyId(surveyOptions[0]?.id || "");
      } catch {
        if (!active) return;
        setError("Gagal memuat data awal approval IT Lead.");
        setSurveys([]);
        setSurveyId("");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void run();

    return () => {
      active = false;
    };
  }, []);

  const loadData = useCallback(async () => {
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
  }, [functionId, surveyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprove = async () => {
    if (selectedRows.length === 0) {
      setError("Pilih minimal satu data untuk di-approve.");
      return;
    }

    const responseIds = Array.from(new Set(selectedRows.map((row) => String(row.ResponseId))));
    const result = await approveFinalResponses({ responseIds });
    if (!result.success) {
      setError(result.message);
      return;
    }

    setSelectedKeys([]);
    setMessage("Response terpilih berhasil di-approve final oleh IT Lead.");
    await loadData();
  };

  const handleProposeTakeout = async () => {
    if (selectedRows.length === 0) {
      setError("Pilih minimal satu data untuk di-propose takeout.");
      return;
    }
    if (!proposeReason.trim()) {
      setError("Alasan propose takeout wajib diisi.");
      return;
    }
    const result = await Promise.all(
      selectedRows.map((row) =>
        proposeTakeout({
          responseId: String(row.ResponseId),
          questionId: String(row.QuestionId),
          reason: proposeReason.trim(),
        })
      )
    );
    const err = mapError(result);
    if (err) {
      setError(err);
      return;
    }
    setProposeOpen(false);
    setProposeReason("");
    setSelectedKeys([]);
    setMessage("Usulan takeout berhasil dikirim ke Admin Event.");
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

      <p className={styles.notice}>IT Lead melakukan approval final response atau propose takeout sebelum data masuk ke report.</p>

      <section className={baseStyles.panel}>
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
              placeholder="Pilih survey"
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
              <span className={styles.meta}>Showing {pendingRows.length} pending IT Lead reviews</span>
              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} onClick={() => void handleApprove()} disabled={selectedRows.length === 0}>
                  Approve Final Response
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => setProposeOpen(true)} disabled={selectedRows.length === 0}>
                  Propose Takeout
                </button>
              </div>
            </div>

            {selectedRows.length > 0 ? <div className={styles.selectionHint}>Selected review items: {selectedRows.length}</div> : null}

            <div className={baseStyles.tableWrap}>
              <table className={baseStyles.table}>
                <thead>
                  <tr>
                    <th scope="col">Department</th>
                    <th scope="col">Aplikasi</th>
                    <th scope="col">Pertanyaan</th>
                    <th scope="col">Score</th>
                    <th scope="col">Komentar</th>
                    <th scope="col">Alasan Takeout</th>
                    <th scope="col">
                        <input
                          aria-label="Pilih semua pending review IT Lead"
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
                      <td colSpan={7} className={styles.empty}>Tidak ada response pending review IT Lead untuk filter ini.</td>
                    </tr>
                  ) : (
                    pendingRows.map((row) => {
                      const key = `${row.ResponseId}-${row.QuestionId}`;
                      return (
                        <tr key={key}>
                          <td>{row.DepartmentName || "-"}</td>
                          <td>{row.ApplicationName || "-"}</td>
                          <td>{row.QuestionText || "-"}</td>
                          <td className={styles.center}>{typeof row.NumericValue === "number" ? row.NumericValue : "-"}</td>
                          <td>{shortText(row.CommentValue)}</td>
                          <td>{shortText(row.TakeoutReason)}</td>
                          <td className={styles.center}>
                            <input
                              aria-label={getPendingReviewAriaLabel(row)}
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
                            aria-label={getFeedbackAriaLabel(row)}
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

      <ApprovalItLeadDialogs
        handleProposeTakeout={handleProposeTakeout}
        proposeOpen={proposeOpen}
        proposeReason={proposeReason}
        selectedRows={selectedRows}
        setProposeOpen={setProposeOpen}
        setProposeReason={setProposeReason}
      />
    </>
  );
}

