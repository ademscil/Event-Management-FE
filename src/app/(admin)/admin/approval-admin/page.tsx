"use client";

import { getCurrentUser } from "@/lib/auth";
import {
  approveTakeout,
  approveInitialResponses,
  fetchApprovalRespondents,
  fetchProposedTakeouts,
  rejectTakeout,
  rejectInitialResponses,
  type ApprovalRespondent,
  type ApprovalTakeout,
} from "@/lib/approvals";
import { Dropdown } from "@/components/common/dropdown";
import { fetchSurveyOverview } from "@/lib/surveys";
import type { UserRole } from "@/types/auth";
import { useEffect, useMemo, useState } from "react";
import baseStyles from "../page-mockup.module.css";
import styles from "../approval.module.css";
import ApprovalAdminDialogs from "./approval-admin-dialogs";
import { formatDateTime, getRespondentAriaLabel, getTakeoutAriaLabel, mapApprovalStatus, toCsvValue, toSafeFileStem } from "./approval-admin-utils";

type Tab = "respondents" | "takeout";
type ModalState = { type: "none" } | { type: "detail"; row: ApprovalRespondent };

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
  const [respondents, setRespondents] = useState<ApprovalRespondent[]>([]);
  const [takeouts, setTakeouts] = useState<ApprovalTakeout[]>([]);
  const [selectedRespondentIds, setSelectedRespondentIds] = useState<string[]>([]);
  const [selectedTakeoutKeys, setSelectedTakeoutKeys] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [takeoutRejectOpen, setTakeoutRejectOpen] = useState(false);
  const [takeoutRejectReason, setTakeoutRejectReason] = useState("");

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
        setError("Gagal memuat data awal halaman approval.");
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
  const selectedTakeoutRows = useMemo(
    () => takeouts.filter((row) => selectedTakeoutKeys.includes(row.QuestionResponseId)),
    [selectedTakeoutKeys, takeouts]
  );
  const surveyDropdownOptions = useMemo(
    () => surveys.map((item) => ({ value: item.id, label: item.title })),
    [surveys]
  );
  const derivedFunctions = useMemo(() => {
    const map = new Map<string, string>();
    takeouts.forEach((item) => {
      if (item.FunctionId && item.FunctionName) {
        map.set(String(item.FunctionId), String(item.FunctionName));
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [takeouts]);
  const functionDropdownOptions = useMemo(
    () => [{ value: "all", label: "All Functions" }, ...derivedFunctions.map((item) => ({ value: item.id, label: item.name }))],
    [derivedFunctions]
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
    const activeSurvey = surveys.find((item) => item.id === surveyId);
    link.download = `approval-admin-respondents-${toSafeFileStem(activeSurvey?.title, "survey")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reloadRespondents = async () => {
    setError("");
    const respondentRes = await fetchApprovalRespondents({ surveyId, duplicateFilter });
    if (!respondentRes.success) {
      setError(respondentRes.message);
      return;
    }
    setRespondents(respondentRes.data);
  };

  const reloadTakeouts = async () => {
    setError("");
    const takeoutRes = await fetchProposedTakeouts({ surveyId, functionId: functionId === "all" ? undefined : functionId });
    if (!takeoutRes.success) {
      setError(takeoutRes.message);
      return;
    }
    setTakeouts(takeoutRes.data);
  };

  const handleApproveSelected = async () => {
    if (selectedRespondentIds.length === 0) {
      setError("Pilih minimal satu response untuk di-approve.");
      return;
    }

    const result = await approveInitialResponses({ responseIds: selectedRespondentIds });
    if (!result.success) {
      setError(result.message);
      return;
    }

    setSelectedRespondentIds([]);
    setMessage("Response terpilih berhasil dikirim ke IT Lead.");
    await reloadRespondents();
  };

  const handleRejectSelected = async () => {
    if (selectedRespondentIds.length === 0) {
      setError("Pilih minimal satu response untuk di-reject.");
      return;
    }
    if (!rejectReason.trim()) {
      setError("Alasan reject wajib diisi.");
      return;
    }

    const result = await rejectInitialResponses({ responseIds: selectedRespondentIds, reason: rejectReason.trim() });
    if (!result.success) {
      setError(result.message);
      return;
    }

    setRejectOpen(false);
    setRejectReason("");
    setSelectedRespondentIds([]);
    setMessage("Response terpilih berhasil di-reject untuk histori.");
    await reloadRespondents();
  };

  const handleApproveTakeouts = async () => {
    if (selectedTakeoutRows.length === 0) {
      setError("Pilih minimal satu usulan takeout untuk di-approve.");
      return;
    }

    const results = await Promise.all(
      selectedTakeoutRows.map((row) =>
        approveTakeout({
          responseId: String(row.ResponseId),
          questionId: String(row.QuestionId),
        })
      )
    );
    const failed = results.find((item) => !item.success);
    if (failed && !failed.success) {
      setError(failed.message);
      return;
    }

    setSelectedTakeoutKeys([]);
    setMessage("Usulan takeout terpilih berhasil di-approve.");
    await Promise.all([reloadRespondents(), reloadTakeouts()]);
  };

  const handleRejectTakeouts = async () => {
    if (selectedTakeoutRows.length === 0) {
      setError("Pilih minimal satu usulan takeout untuk di-reject.");
      return;
    }
    if (!takeoutRejectReason.trim()) {
      setError("Alasan reject takeout wajib diisi.");
      return;
    }

    const results = await Promise.all(
      selectedTakeoutRows.map((row) =>
        rejectTakeout({
          responseId: String(row.ResponseId),
          questionId: String(row.QuestionId),
          reason: takeoutRejectReason.trim(),
        })
      )
    );
    const failed = results.find((item) => !item.success);
    if (failed && !failed.success) {
      setError(failed.message);
      return;
    }

    setTakeoutRejectOpen(false);
    setTakeoutRejectReason("");
    setSelectedTakeoutKeys([]);
    setMessage("Usulan takeout terpilih berhasil di-reject.");
    await Promise.all([reloadRespondents(), reloadTakeouts()]);
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
                <button type="button" className={styles.btnPrimary} onClick={() => void handleApproveSelected()} disabled={selectedRespondentIds.length === 0}>
                  Approve Selected
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => setRejectOpen(true)} disabled={selectedRespondentIds.length === 0}>
                  Reject Selected
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
                    <th scope="col">Status</th>
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
                      <td colSpan={9} className={styles.empty}>Belum ada data responden.</td>
                    </tr>
                  ) : (
                    respondents.map((row) => {
                      const selected = selectedRespondentIds.includes(row.ResponseId);
                      const statusMeta = mapApprovalStatus(row.ResponseApprovalStatus);
                      return (
                        <tr key={row.ResponseId}>
                          <td>{row.RespondentName || "-"}</td>
                          <td>{row.DepartmentName || "-"}</td>
                          <td>{row.ApplicationName || "-"}</td>
                          <td>{row.RespondentEmail || "-"}</td>
                          <td>{formatDateTime(row.SubmittedAt)}</td>
                          <td className={styles.center}>
                            <span className={`${styles.pill} ${statusMeta.tone}`}>{statusMeta.label}</span>
                          </td>
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
                              aria-label={getRespondentAriaLabel(row)}
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
                <button type="button" className={styles.btnPrimary} onClick={() => void handleApproveTakeouts()} disabled={selectedTakeoutRows.length === 0}>
                  Approve Takeout
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => setTakeoutRejectOpen(true)} disabled={selectedTakeoutRows.length === 0}>
                  Reject Takeout
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => setSelectedTakeoutKeys([])} disabled={selectedTakeoutRows.length === 0}>
                  Clear Selection
                </button>
              </div>
            </div>

            {selectedTakeoutRows.length > 0 ? <div className={styles.selectionHint}>Selected takeout items: {selectedTakeoutRows.length}</div> : null}

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
                    <th scope="col">
                      <input
                        aria-label="Pilih semua usulan takeout"
                        type="checkbox"
                        checked={selectedTakeoutKeys.length > 0 && selectedTakeoutKeys.length === takeouts.length}
                        onChange={(event) =>
                          setSelectedTakeoutKeys(event.target.checked ? takeouts.map((row) => row.QuestionResponseId) : [])
                        }
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {takeouts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={styles.empty}>Belum ada proposed takeout.</td>
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
                        <td className={styles.center}>
                          <input
                            aria-label={getTakeoutAriaLabel(row)}
                            type="checkbox"
                            checked={selectedTakeoutKeys.includes(row.QuestionResponseId)}
                            onChange={(event) =>
                              setSelectedTakeoutKeys((prev) => {
                                if (event.target.checked) {
                                  return Array.from(new Set([...prev, row.QuestionResponseId]));
                                }
                                return prev.filter((id) => id !== row.QuestionResponseId);
                              })
                            }
                          />
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

      <ApprovalAdminDialogs
        handleRejectSelected={handleRejectSelected}
        handleRejectTakeouts={handleRejectTakeouts}
        modal={modal}
        rejectOpen={rejectOpen}
        rejectReason={rejectReason}
        selectedRespondentIds={selectedRespondentIds}
        selectedTakeoutRows={selectedTakeoutRows}
        setModal={setModal}
        setRejectOpen={setRejectOpen}
        setRejectReason={setRejectReason}
        setTakeoutRejectOpen={setTakeoutRejectOpen}
        setTakeoutRejectReason={setTakeoutRejectReason}
        takeoutRejectOpen={takeoutRejectOpen}
        takeoutRejectReason={takeoutRejectReason}
      />
    </>
  );
}

