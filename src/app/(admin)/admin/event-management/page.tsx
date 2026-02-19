"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { getCurrentUser } from "@/lib/auth";
import { createEventDraft, fetchSurveyOverview } from "@/lib/surveys";
import { searchAdminEventUsers, type AdminEventUser } from "@/lib/users";
import type { UserRole } from "@/types/auth";
import type { SurveyOverviewItem } from "@/types/survey";
import { useEffect, useMemo, useState } from "react";
import { SearchBar } from "@/components/admin/search-bar";
import styles from "../page-mockup.module.css";

function formatPeriod(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const format = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${format.format(start)} - ${format.format(end)}`;
}

function formatLastEdited(updatedAt?: string | null, createdAt?: string | null): string {
  const sourceDate = updatedAt || createdAt;
  if (!sourceDate) return "-";
  const date = new Date(sourceDate);
  const today = new Date();
  const diffInDays = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  if (diffInDays <= 0) return "Just now";
  if (diffInDays === 1) return "Yesterday";
  return `${diffInDays} days ago`;
}

function getStatusLabel(status: string): string {
  if (status === "Draft") return "Draft Empty";
  return status;
}

function getStatusClass(status: string): string {
  if (status === "Active") return styles.badgeActive;
  if (status === "Draft") return styles.badgeClosed;
  if (status === "In Design") return styles.badgeWarning;
  return styles.badgeClosed;
}

function matchesDateRange(survey: SurveyOverviewItem, start: string, end: string): boolean {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const surveyStart = new Date(survey.StartDate);
  const surveyEnd = new Date(survey.EndDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return true;
  return surveyStart >= startDate && surveyEnd <= endDate;
}

function matchesStatusFilter(status: string, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "draft") return status === "Draft";
  if (filter === "design") return status === "In Design";
  if (filter === "active") return status === "Active";
  if (filter === "closed") return status === "Closed";
  return true;
}

export default function EventManagementPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [adminEventInput, setAdminEventInput] = useState("");
  const [selectedAdminEvents, setSelectedAdminEvents] = useState<AdminEventUser[]>([]);
  const [adminEventSuggestions, setAdminEventSuggestions] = useState<AdminEventUser[]>([]);
  const [showAdminSuggestion, setShowAdminSuggestion] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");

  const [periodStart, setPeriodStart] = useState("2026-01-01");
  const [periodEnd, setPeriodEnd] = useState("2026-12-31");
  const [statusFilter, setStatusFilter] = useState("all");

  const [surveys, setSurveys] = useState<SurveyOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentRole] = useState<UserRole | null>(() => getCurrentUser()?.role ?? null);

  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const activeAdminQuery = useMemo(() => adminEventInput.trim(), [adminEventInput]);

  const loadEvents = async () => {
    setLoading(true);
    const result = await fetchSurveyOverview();
    setLoading(false);
    if (!result.success) {
      setError(result.message || "Gagal memuat data survey");
      setSurveys([]);
      return;
    }
    setError("");
    setSurveys(result.surveys);
  };

  useEffect(() => {
    void loadEvents();
  }, []);

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
        if (!matchesDateRange(survey, periodStart, periodEnd)) return false;
        if (!matchesStatusFilter(survey.Status, statusFilter)) return false;

        if (!normalizedKeyword) return true;

        if (appliedSearchBy === "event") {
          return survey.Title.toLowerCase().includes(normalizedKeyword);
        }

        if (appliedSearchBy === "admin") {
          return (survey.AssignedAdminName || "").toLowerCase().includes(normalizedKeyword);
        }

        return (
          survey.Title.toLowerCase().includes(normalizedKeyword) ||
          (survey.AssignedAdminName || "").toLowerCase().includes(normalizedKeyword) ||
          survey.Status.toLowerCase().includes(normalizedKeyword)
        );
      })
      .sort((a, b) => {
        const aDate = new Date(a.UpdatedAt || a.CreatedAt || 0).getTime();
        const bDate = new Date(b.UpdatedAt || b.CreatedAt || 0).getTime();
        return bDate - aDate;
      });
  }, [surveys, periodStart, periodEnd, statusFilter, appliedSearchBy, appliedKeyword]);

  const closeModal = () => {
    setShowCreateModal(false);
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
      window.alert("Please fill all required fields");
      return;
    }

    setSubmitting(true);
    const createResult = await createEventDraft({
      title: draftName.trim(),
      description: `[Admin Event Target: ${selectedAdminEvents
        .map((item) => item.DisplayName)
        .join(", ")}] ${draftDescription.trim()}`.trim(),
      startDate: new Date(periodStart).toISOString(),
      endDate: new Date(periodEnd).toISOString(),
      assignedAdminId: selectedAdminEvents[0]?.UserId,
    });
    setSubmitting(false);

    if (!createResult.success) {
      window.alert(createResult.message || "Gagal membuat event");
      return;
    }

    closeModal();
    await loadEvents();
  };

  const canCreateEvent = currentRole === "SuperAdmin";

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
              + Create Survey Event
            </button>
          </div>
        ) : null}
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Filter</h2>
        <div className={styles.periodRow}>
          <div className={styles.periodLabel}>PERIOD</div>
          <div className={styles.periodColon}>:</div>
          <input
            id="periodStart"
            className={`${styles.input} ${styles.periodInput}`}
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
          />
          <input
            className={`${styles.input} ${styles.periodInput}`}
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
          />
        </div>

        <div className={styles.periodRow}>
          <div className={styles.periodLabel}>STATUS</div>
          <div className={styles.periodColon}>:</div>
          <select
            id="status"
            className={`${styles.select} ${styles.statusControl}`}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All</option>
            <option value="draft">Draft Empty</option>
            <option value="design">In Design</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <SearchBar
          rowClassName={styles.masterSearchRow}
          selectClassName={styles.masterSearchSelect}
          inputClassName={`${styles.input} ${styles.masterSearchInput}`}
          buttonClassName={styles.masterSearchButton}
          options={[
            { value: "all", label: "Search By" },
            { value: "event", label: "Event Name" },
            { value: "admin", label: "Admin Event" },
          ]}
          selectedValue={searchBy}
          keyword={keyword}
          onSelectedValueChange={setSearchBy}
          onKeywordChange={setKeyword}
          onButtonClick={onApplySearch}
        />
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
                  <th>Nama Event</th>
                  <th>Admin Event</th>
                  <th>Periode</th>
                  <th>Status</th>
                  <th>Last Edited</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSurveys.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Tidak ada data survey</td>
                  </tr>
                ) : (
                  filteredAndSortedSurveys.map((row) => (
                    <tr key={row.SurveyId}>
                      <td>{row.Title}</td>
                      <td>{row.AssignedAdminName || "-"}</td>
                      <td>{formatPeriod(row.StartDate, row.EndDate)}</td>
                      <td>
                        <span className={`${styles.badge} ${getStatusClass(row.Status)}`}>
                          {getStatusLabel(row.Status)}
                        </span>
                      </td>
                      <td>{formatLastEdited(row.UpdatedAt, row.CreatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {showCreateModal ? (
        <div className={styles.modalOverlay} onClick={closeModal} role="presentation">
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create Survey Event"
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Create Survey Event</h2>
              <button className={styles.modalClose} onClick={closeModal} type="button" aria-label="Close">
                x
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="surveyName">
                  Survey Name *
                </label>
                <input
                  id="surveyName"
                  className={styles.input}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="e.g. Survey Corp IT & BPM 2026"
                  type="text"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="surveyAdminEvent">
                  Admin Event Target *
                </label>
                <div className={styles.chipInputWrap}>
                  {selectedAdminEvents.map((user) => (
                    <span key={user.UserId} className={styles.chip}>
                      {user.DisplayName}
                      <button
                        className={styles.chipRemove}
                        onClick={() => removeAdminSelection(user.UserId)}
                        type="button"
                        aria-label={`Remove ${user.DisplayName}`}
                      >
                        x
                      </button>
                    </span>
                  ))}
                  <input
                    id="surveyAdminEvent"
                    className={styles.chipInput}
                    value={adminEventInput}
                    onChange={(event) => {
                      setAdminEventInput(event.target.value);
                      setShowAdminSuggestion(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && adminEventSuggestions.length > 0) {
                        event.preventDefault();
                        applyAdminSelection(adminEventSuggestions[0]);
                      }
                      if (
                        event.key === "Backspace" &&
                        adminEventInput.length === 0 &&
                        selectedAdminEvents.length > 0
                      ) {
                        const last = selectedAdminEvents[selectedAdminEvents.length - 1];
                        removeAdminSelection(last.UserId);
                      }
                    }}
                    onFocus={() => setShowAdminSuggestion(true)}
                    onBlur={() => {
                      setTimeout(() => setShowAdminSuggestion(false), 120);
                    }}
                    placeholder={selectedAdminEvents.length === 0 ? "e.g. Firman" : "Tambah Admin Event"}
                    type="text"
                    autoComplete="off"
                  />
                </div>
                {showAdminSuggestion && adminEventSuggestions.length > 0 ? (
                  <div className={styles.suggestionMenu}>
                    {adminEventSuggestions.map((user) => (
                      <button
                        key={user.UserId}
                        className={styles.suggestionItem}
                        onClick={() => applyAdminSelection(user)}
                        type="button"
                      >
                        <span>{user.DisplayName}</span>
                        <span className={styles.suggestionMeta}>{user.Email}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="surveyDesc">
                  Description
                </label>
                <textarea
                  id="surveyDesc"
                  className={styles.textarea}
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  placeholder="Survey description"
                  rows={3}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={closeModal} type="button">
                Cancel
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleCreateDraft}
                disabled={submitting}
                type="button"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
