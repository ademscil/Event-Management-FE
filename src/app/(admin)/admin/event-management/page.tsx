"use client";

import { getCurrentUser } from "@/lib/auth";
import { formatEventPeriod, getEventStatusLabel, resolveEventStatus } from "@/lib/event-status";
import { createEventDraft, deleteEventById, fetchSurveyById, fetchSurveyOverview, updateEventById } from "@/lib/surveys";
import { searchAdminEventUsers, type AdminEventUser } from "@/lib/users";
import type { UserRole } from "@/types/auth";
import type { SurveyOverviewItem } from "@/types/survey";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import styles from "../page-mockup.module.css";
import CreateEventModal from "./create-event-modal";
import {
  formatLastEdited,
  getStatusClass,
  matchesDateRange,
  matchesStatusFilter,
  sanitizeSurveyDescription,
} from "./event-management-utils";

export default function EventManagementPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eventType, setEventType] = useState<"survey" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [adminEventInput, setAdminEventInput] = useState("");
  const [selectedAdminEvents, setSelectedAdminEvents] = useState<AdminEventUser[]>([]);
  const [adminEventSuggestions, setAdminEventSuggestions] = useState<AdminEventUser[]>([]);
  const [showAdminSuggestion, setShowAdminSuggestion] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [surveys, setSurveys] = useState<SurveyOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackDialog, setFeedbackDialog] = useState<{ title: string; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SurveyOverviewItem | null>(null);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);

  const [currentUser] = useState(() => getCurrentUser());
  const [currentRole] = useState<UserRole | null>(() => currentUser?.role ?? null);

  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");


  const activeAdminQuery = useMemo(() => adminEventInput.trim(), [adminEventInput]);

  const loadEvents = useCallback(async () => {
    setLoading(true);

    try {
      const roleBasedFilter = currentRole === "AdminEvent" && currentUser?.userId
        ? { assignedAdminId: String(currentUser.userId) }
        : undefined;

      const result = await fetchSurveyOverview(roleBasedFilter);

      if (!result.success) {
        setError(result.message || "Gagal memuat data survey");
        setSurveys([]);
        return;
      }

      setError("");
      setSurveys(result.surveys);
    } catch {
      setError("Terjadi kesalahan saat memuat data survey");
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  }, [currentRole, currentUser]);
  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!showCreateModal) return;
    const query = activeAdminQuery;
    if (query.length < 2) {
      setAdminEventSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const result = await searchAdminEventUsers(query);
      if (!result.success) {
        setAdminEventSuggestions([]);
        return;
      }
      setAdminEventSuggestions(result.users);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [activeAdminQuery, showCreateModal]);

  const filteredAndSortedSurveys = useMemo(() => {
    const normalizedKeyword = appliedKeyword.trim().toLowerCase();

    return surveys
      .filter((survey) => {
        const effectiveStatus = resolveEventStatus(survey);

        if (currentRole === "AdminEvent" && currentUser?.userId) {
          const currentUserId = String(currentUser.userId);
          const assignedIds = survey.AssignedAdminIds || [];
          if (!assignedIds.includes(currentUserId)) {
            return false;
          }
        }

        if (!matchesDateRange(survey, periodStart, periodEnd)) return false;
        if (!matchesStatusFilter(effectiveStatus, statusFilter)) return false;

        if (!normalizedKeyword) return true;

        if (appliedSearchBy === "event") {
          return survey.Title.toLowerCase().includes(normalizedKeyword);
        }

        if (appliedSearchBy === "admin") {
          return (survey.AssignedAdminName || "").toLowerCase().includes(normalizedKeyword);
        }

        return (
          survey.Title.toLowerCase().includes(normalizedKeyword) ||
          (survey.AssignedAdminName || "").toLowerCase().includes(normalizedKeyword)
        );
      })
      .sort((a, b) => {
        const aDate = new Date(a.UpdatedAt || a.CreatedAt || 0).getTime();
        const bDate = new Date(b.UpdatedAt || b.CreatedAt || 0).getTime();
        return bDate - aDate;
      });
  }, [
    surveys,
    currentRole,
    currentUser,
    periodStart,
    periodEnd,
    statusFilter,
    appliedSearchBy,
    appliedKeyword,
  ]);


  const closeModal = () => {
    setShowCreateModal(false);
    setEventType(null);
    setEditingSurveyId(null);
    setDraftName("");
    setAdminEventInput("");
    setSelectedAdminEvents([]);
    setAdminEventSuggestions([]);
    setShowAdminSuggestion(false);
    setDraftDescription("");
  };

  const applyAdminSelection = (user: AdminEventUser) => {
    setSelectedAdminEvents((previous) => {
      if (previous.some((item) => item.UserId === user.UserId)) {
        return previous;
      }
      return [...previous, user];
    });
    setAdminEventInput("");
    setShowAdminSuggestion(false);
    setAdminEventSuggestions([]);
  };

  const removeAdminSelection = (userId: string) => {
    setSelectedAdminEvents((previous) => previous.filter((item) => item.UserId !== userId));
  };

  const handleCreateDraft = async () => {
    if (!draftName.trim() || selectedAdminEvents.length === 0) {
      setFeedbackDialog({
        title: "Data Belum Lengkap",
        message: "Survey Name dan Admin Event Target wajib diisi sebelum membuat event.",
      });
      return;
    }

    const cleanedDescription = sanitizeSurveyDescription(draftDescription);

    setSubmitting(true);
    const requestPayload = {
      title: draftName.trim(),
      description: cleanedDescription,
      assignedAdminId: selectedAdminEvents[0]?.UserId,
      assignedAdminIds: selectedAdminEvents.map((user) => user.UserId),
      status: "Draft",
    };
    const createResult = editingSurveyId
      ? await updateEventById(editingSurveyId, requestPayload)
      : await createEventDraft(requestPayload);
    setSubmitting(false);

    if (!createResult.success) {
      setFeedbackDialog({
        title: editingSurveyId ? "Gagal Mengubah Event" : "Gagal Membuat Event",
        message: createResult.message || (editingSurveyId ? "Gagal mengubah event" : "Gagal membuat event"),
      });
      return;
    }

    closeModal();
    await loadEvents();
  };

  const handleEditDraft = async (surveyId: string) => {
    setSubmitting(true);
    const result = await fetchSurveyById(surveyId);
    setSubmitting(false);

    if (!result.success || !result.survey) {
      setFeedbackDialog({
        title: "Gagal Memuat Event",
        message: result.message || "Detail event tidak dapat dimuat.",
      });
      return;
    }

    setEditingSurveyId(surveyId);
    setEventType("survey");
    setDraftName(result.survey.Title || "");
    setDraftDescription(result.survey.Description || "");
    const assignedAdminIds = result.survey.AssignedAdminIds || (result.survey.AssignedAdminId ? [String(result.survey.AssignedAdminId)] : []);
    const assignedAdminNames = result.survey.AssignedAdminNames || (result.survey.AssignedAdminName ? [result.survey.AssignedAdminName] : []);
    const assignedAdminUsernames = result.survey.AssignedAdminUsernames || [];
    setSelectedAdminEvents(
      assignedAdminIds.map((userId, index) => ({
        UserId: String(userId),
        DisplayName: String(assignedAdminNames[index] || assignedAdminNames[0] || assignedAdminUsernames[index] || assignedAdminUsernames[0] || `Admin Event ${index + 1}`),
        Username: String(assignedAdminUsernames[index] || assignedAdminUsernames[0] || ""),
        Email: "",
        Role: "AdminEvent",
        IsActive: true,
      })),
    );
    setAdminEventInput("");
    setAdminEventSuggestions([]);
    setShowAdminSuggestion(false);
    setShowCreateModal(true);
  };

  const handleDeleteDraft = async () => {
    if (!deleteTarget) return;

    setSubmitting(true);
    const result = await deleteEventById(deleteTarget.SurveyId);
    setSubmitting(false);

    if (!result.success) {
      setFeedbackDialog({
        title: "Gagal Menghapus Event",
        message: result.message || "Gagal menghapus event.",
      });
      return;
    }

    setDeleteTarget(null);
    await loadEvents();
    setFeedbackDialog({
      title: "Event Dihapus",
      message: "Draft event berhasil dihapus.",
    });
  };


  const canCreateEvent = currentRole === "SuperAdmin";
  const isSuperAdmin = currentRole === "SuperAdmin";
  const showActionColumn = currentRole === "AdminEvent" || isSuperAdmin;

  const onApplySearch = () => {
    setAppliedSearchBy(searchBy);
    setAppliedKeyword(keyword);
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Event Management</h1>
          <div className={styles.subtitle}>
            Admin Superuser membuat draft kosong, Admin Event melanjutkan desain &amp; mapping.
          </div>
        </div>
        {canCreateEvent ? (
          <div className={styles.toolbar}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setShowCreateModal(true)}
              type="button"
            >
              Create Event
            </button>
          </div>
        ) : null}
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Filter</h2>
        <div className={styles.filterToolbar}>
          <div className={`${styles.filterGroup} ${styles.filterGroupSm}`}>
            <label className={styles.filterLabel} htmlFor="evtPeriodStart">Periode Mulai</label>
            <input id="evtPeriodStart" className={styles.filterControl} type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className={`${styles.filterGroup} ${styles.filterGroupSm}`}>
            <label className={styles.filterLabel} htmlFor="evtPeriodEnd">Periode Akhir</label>
            <input id="evtPeriodEnd" className={styles.filterControl} type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div className={`${styles.filterGroup} ${styles.filterGroupMd}`}>
            <label className={styles.filterLabel}>Status</label>
            <Dropdown className={styles.filterControl} fullWidth options={[{ value: "all", label: "Semua Status" }, { value: "draft", label: "Draft" }, { value: "design", label: "In Design" }, { value: "active", label: "Active" }, { value: "closed", label: "Closed" }]} value={statusFilter} onChange={setStatusFilter} />
          </div>
          <SearchBar options={[{ value: "all", label: "Search By" }, { value: "event", label: "Event Name" }, { value: "admin", label: "Admin Event" }]} selectedValue={searchBy} keyword={keyword} onSelectedValueChange={setSearchBy} onKeywordChange={setKeyword} onButtonClick={onApplySearch} placeholder="Cari event..." />
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Daftar Event</h2>
          <span className={styles.meta}>Showing {filteredAndSortedSurveys.length} surveys</span>
        </div>
        {error ? <div className={styles.meta}>{error}</div> : null}
        {loading ? <div className={styles.meta}>Memuat data event...</div> : null}
        {!loading && !error ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nama Event</th>
                  <th scope="col">Admin Event</th>
                  <th scope="col">Periode</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last Edited</th>
                  {showActionColumn ? <th scope="col">Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSurveys.length === 0 ? (
                  <tr>
                    <td colSpan={showActionColumn ? 6 : 5}>Tidak ada data survey</td>
                  </tr>
                ) : (
                  filteredAndSortedSurveys.map((row) => {
                    const effectiveStatus = resolveEventStatus(row);
                    const canContinueDesignAction =
                      effectiveStatus === "Draft" || effectiveStatus === "In Design" || effectiveStatus === "Active";
                    const canOpenOperations = effectiveStatus === "Active";

                    return (
                      <tr key={row.SurveyId}>
                        <td>{row.Title}</td>
                        <td>{row.AssignedAdminName || "-"}</td>
                        <td>{formatEventPeriod(row.StartDate, row.EndDate)}</td>
                        <td>
                          <span className={`${styles.badge} ${getStatusClass(effectiveStatus)}`}>
                            {getEventStatusLabel(effectiveStatus)}
                          </span>
                        </td>
                        <td>{formatLastEdited(row.UpdatedAt, row.CreatedAt)}</td>
                        {showActionColumn ? (
                          <td>
                            {isSuperAdmin ? (
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                  type="button"
                                  className={`${styles.btn} ${styles.btnSecondary}`}
                                  onClick={() => void handleEditDraft(row.SurveyId)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.btn} ${styles.btnDanger}`}
                                  onClick={() => setDeleteTarget(row)}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : canContinueDesignAction ? (
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <Link
                                  href={`/admin/event-management/survey-create?surveyId=${row.SurveyId}`}
                                  className={`${styles.btn} ${styles.btnSecondary}`}
                                >
                                  Continue Design
                                </Link>
                                {canOpenOperations ? (
                                  <Link
                                    href={`/admin/event-management/${row.SurveyId}/operations`}
                                    className={`${styles.btn} ${styles.btnPrimary}`}
                                  >
                                    Operations
                                  </Link>
                                ) : null}
                              </div>
                            ) : (
                              <span className={styles.meta}>No action</span>
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
        ) : null}
      </section>

      <CreateEventModal
        adminEventInput={adminEventInput}
        adminEventSuggestions={adminEventSuggestions}
        applyAdminSelection={applyAdminSelection}
        closeModal={closeModal}
        draftDescription={draftDescription}
        draftName={draftName}
        eventType={eventType}
        handleCreateDraft={handleCreateDraft}
        removeAdminSelection={removeAdminSelection}
        selectedAdminEvents={selectedAdminEvents}
        setAdminEventInput={setAdminEventInput}
        setDraftDescription={setDraftDescription}
        setDraftName={setDraftName}
        setEventType={setEventType}
        setShowAdminSuggestion={setShowAdminSuggestion}
        showAdminSuggestion={showAdminSuggestion}
        showCreateModal={showCreateModal}
        submitting={submitting}
        submitLabel={editingSurveyId ? "Save" : "Create"}
        title={editingSurveyId ? "Edit Survey Event" : undefined}
      />
      {deleteTarget ? (
        <div className={styles.modalOverlay} onClick={() => setDeleteTarget(null)} role="presentation">
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-modal-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="delete-event-modal-title" className={styles.modalTitle}>Delete Draft Event</h2>
              <button className={styles.modalClose} onClick={() => setDeleteTarget(null)} type="button" aria-label="Tutup modal">
                x
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.meta} style={{ margin: 0, color: "#475569" }}>
                Hapus draft <strong>{deleteTarget.Title}</strong>? Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setDeleteTarget(null)} type="button">
                Cancel
              </button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => void handleDeleteDraft()} disabled={submitting} type="button">
                {submitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {feedbackDialog ? (
        <div className={styles.modalOverlay} onClick={() => setFeedbackDialog(null)} role="presentation">
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-event-modal-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="feedback-event-modal-title" className={styles.modalTitle}>{feedbackDialog.title}</h2>
              <button className={styles.modalClose} onClick={() => setFeedbackDialog(null)} type="button" aria-label="Tutup modal">
                x
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.meta} style={{ margin: 0, color: "#475569" }}>
                {feedbackDialog.message}
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={() => setFeedbackDialog(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
