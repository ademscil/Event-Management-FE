"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { getCurrentUser } from "@/lib/auth";
import {
  createEventDraft,
  fetchSurveyOverview,
  generateEventLink,
  scheduleEventBlast,
  scheduleEventReminder,
} from "@/lib/surveys";
import { searchAdminEventUsers, type AdminEventUser } from "@/lib/users";
import type { UserRole } from "@/types/auth";
import type { SurveyOverviewItem } from "@/types/survey";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function toIsoString(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function getDefaultDateTimeLocal(): string {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
    value.getHours(),
  )}:${pad(value.getMinutes())}`;
}

function getDefaultDateLocal(): string {
  return getDefaultDateTimeLocal().slice(0, 10);
}

function getDefaultTimeLocal(): string {
  return getDefaultDateTimeLocal().slice(11, 16);
}

function getDayOfWeekFromLocalDateTime(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 1;
  return date.getDay();
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

  const [periodStart, setPeriodStart] = useState("2024-01-01");
  const [periodEnd, setPeriodEnd] = useState("2026-12-31");
  const [statusFilter, setStatusFilter] = useState("all");

  const [surveys, setSurveys] = useState<SurveyOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser] = useState(() => getCurrentUser());
  const [currentRole] = useState<UserRole | null>(() => currentUser?.role ?? null);

  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const [shortenUrl, setShortenUrl] = useState(false);
  const [embedCover, setEmbedCover] = useState(true);
  const [channelTab, setChannelTab] = useState<"invitation" | "qr" | "embed">("invitation");
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);

  const [blastMode, setBlastMode] = useState<"once" | "recurring">("once");
  const [blastFrequency, setBlastFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [blastDateTime, setBlastDateTime] = useState(getDefaultDateTimeLocal());
  const [blastStartDate, setBlastStartDate] = useState(getDefaultDateLocal());
  const [blastTime, setBlastTime] = useState(getDefaultTimeLocal());
  const [blastDayOfWeek, setBlastDayOfWeek] = useState(getDayOfWeekFromLocalDateTime(getDefaultDateTimeLocal()));
  const [blastMessage, setBlastMessage] = useState("Hi! Would you mind taking 2 minutes to complete this form? It would help us improve our service.");
  const [blastLoading, setBlastLoading] = useState(false);

  const [reminderRecipients, setReminderRecipients] = useState("app-portalb2b@component.astra.co.id");
  const [reminderMode, setReminderMode] = useState<"once" | "recurring">("once");
  const [reminderFrequency, setReminderFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [reminderDateTime, setReminderDateTime] = useState(getDefaultDateTimeLocal());
  const [reminderStartDate, setReminderStartDate] = useState(getDefaultDateLocal());
  const [reminderTime, setReminderTime] = useState(getDefaultTimeLocal());
  const [reminderDayOfWeek, setReminderDayOfWeek] = useState(getDayOfWeekFromLocalDateTime(getDefaultDateTimeLocal()));
  const [reminderMessage, setReminderMessage] = useState("Reminder: Mohon isi survey yang sedang berjalan. Terima kasih.");
  const [reminderLoading, setReminderLoading] = useState(false);

  const [operationFeedback, setOperationFeedback] = useState("");

  const activeAdminQuery = useMemo(() => adminEventInput.trim(), [adminEventInput]);

  const loadEvents = useCallback(async () => {
    setLoading(true);

    const roleBasedFilter = currentRole === "AdminEvent" && currentUser?.userId
      ? { assignedAdminId: String(currentUser.userId) }
      : undefined;

    const result = await fetchSurveyOverview(roleBasedFilter);
    setLoading(false);

    if (!result.success) {
      setError(result.message || "Gagal memuat data survey");
      setSurveys([]);
      return;
    }

    setError("");
    setSurveys(result.surveys);
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
        if (currentRole === "AdminEvent" && currentUser?.userId) {
          const currentUserId = String(currentUser.userId);
          const assignedIds = survey.AssignedAdminIds || [];
          if (!assignedIds.includes(currentUserId)) {
            return false;
          }
        }

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

  useEffect(() => {
    if (filteredAndSortedSurveys.length === 0) {
      setSelectedSurveyId("");
      return;
    }

    const exists = filteredAndSortedSurveys.some((item) => item.SurveyId === selectedSurveyId);
    if (!exists) {
      setSelectedSurveyId(filteredAndSortedSurveys[0].SurveyId);
      setGeneratedLink("");
      setOperationFeedback("");
    }
  }, [filteredAndSortedSurveys, selectedSurveyId]);

  const selectedSurvey = useMemo(
    () => filteredAndSortedSurveys.find((item) => item.SurveyId === selectedSurveyId) || null,
    [filteredAndSortedSurveys, selectedSurveyId],
  );

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

  const handleGenerateLink = async () => {
    if (!selectedSurveyId) return;
    setLinkLoading(true);
    setOperationFeedback("");

    const result = await generateEventLink(selectedSurveyId, shortenUrl);
    setLinkLoading(false);

    if (!result.success) {
      setOperationFeedback(result.message || "Gagal generate link");
      return;
    }

    const resolvedLink = result.shortenedLink || result.surveyLink || "";
    setGeneratedLink(resolvedLink);
    setOperationFeedback("Link berhasil dibuat");
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setOperationFeedback("Link berhasil disalin");
  };

  const handleSendBlast = async () => {
    if (!selectedSurveyId) return;

    let scheduledDate: string | null = null;
    let frequency: "once" | "daily" | "weekly" | "monthly" = "once";
    let scheduledTime: string | undefined;
    let dayOfWeek: number | undefined;

    if (blastMode === "once") {
      scheduledDate = toIsoString(blastDateTime);
      dayOfWeek = getDayOfWeekFromLocalDateTime(blastDateTime);
    } else {
      scheduledDate = toIsoString(`${blastStartDate}T00:00`);
      frequency = blastFrequency;
      scheduledTime = blastTime;
      dayOfWeek = blastFrequency === "weekly" ? blastDayOfWeek : undefined;
    }

    if (!scheduledDate || !blastMessage.trim()) {
      setOperationFeedback("Blast schedule dan message wajib diisi");
      return;
    }

    setBlastLoading(true);
    setOperationFeedback("");

    const result = await scheduleEventBlast({
      surveyId: selectedSurveyId,
      scheduledDate,
      emailTemplate: blastMessage.trim(),
      embedCover,
      frequency,
      scheduledTime,
      dayOfWeek,
    });

    setBlastLoading(false);
    setOperationFeedback(result.success ? "Blast schedule berhasil disimpan" : result.message || "Gagal simpan blast");
  };

  const handleSendReminder = async () => {
    if (!selectedSurveyId) return;

    let scheduledDate: string | null = null;
    let frequency: "once" | "daily" | "weekly" | "monthly" = "once";
    let scheduledTime: string | undefined;
    let dayOfWeek: number | undefined;

    if (reminderMode === "once") {
      scheduledDate = toIsoString(reminderDateTime);
      dayOfWeek = getDayOfWeekFromLocalDateTime(reminderDateTime);
    } else {
      scheduledDate = toIsoString(`${reminderStartDate}T00:00`);
      frequency = reminderFrequency;
      scheduledTime = reminderTime;
      dayOfWeek = reminderFrequency === "weekly" ? reminderDayOfWeek : undefined;
    }

    if (!scheduledDate || !reminderMessage.trim()) {
      setOperationFeedback("Reminder schedule dan message wajib diisi");
      return;
    }

    setReminderLoading(true);
    setOperationFeedback("");

    const body = `${reminderRecipients.trim() ? `Recipients: ${reminderRecipients.trim()}\n\n` : ""}${reminderMessage.trim()}`;
    const result = await scheduleEventReminder({
      surveyId: selectedSurveyId,
      scheduledDate,
      emailTemplate: body,
      embedCover: false,
      frequency,
      scheduledTime,
      dayOfWeek,
    });

    setReminderLoading(false);
    setOperationFeedback(
      result.success ? "Reminder schedule berhasil disimpan" : result.message || "Gagal simpan reminder",
    );
  };

  const canCreateEvent = currentRole === "SuperAdmin";
  const showOperationalPanel = currentRole === "AdminEvent";
  const showContinueDesign = currentRole === "AdminEvent";

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
                  {showContinueDesign ? <th>Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSurveys.length === 0 ? (
                  <tr>
                    <td colSpan={showContinueDesign ? 6 : 5}>Tidak ada data survey</td>
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
                      {showContinueDesign ? (
                        <td>
                          <Link
                            href={`/admin/event-management/survey-create?surveyId=${row.SurveyId}`}
                            className={`${styles.btn} ${styles.btnSecondary}`}
                          >
                            Continue Design
                          </Link>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {showOperationalPanel ? (
        <section className={`${styles.panel} ${styles.opsPanel}`}>
          <div className={styles.opsHero}>
            <div>
              <h2 className={styles.panelTitle}>Operational Controls</h2>
              <p className={styles.opsSubtitle}>Create link distribution, blast schedule, and reminder in one flow.</p>
            </div>
            <span className={styles.opsPill}>Send and collect responses</span>
          </div>

          <div className={styles.opsLayout}>
            <div className={styles.opsPrimary}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="opsSurveySelect">
                  Survey
                </label>
                <select
                  id="opsSurveySelect"
                  className={styles.select}
                  value={selectedSurveyId}
                  onChange={(event) => {
                    setSelectedSurveyId(event.target.value);
                    setGeneratedLink("");
                    setOperationFeedback("");
                  }}
                >
                  {filteredAndSortedSurveys.length === 0 ? <option value="">Tidak ada survey</option> : null}
                  {filteredAndSortedSurveys.map((item) => (
                    <option key={item.SurveyId} value={item.SurveyId}>
                      {item.Title}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.opsBlock}>
                <div className={styles.opsBlockHead}>
                  <h3 className={styles.opsBlockTitle}>Distribution Link</h3>
                  <label className={styles.inlineCheck}>
                    <input
                      type="checkbox"
                      checked={shortenUrl}
                      onChange={(event) => setShortenUrl(event.target.checked)}
                    />
                    Shorten URL
                  </label>
                </div>
                <div className={styles.linkRowModern}>
                  <input
                    className={styles.input}
                    type="text"
                    readOnly
                    value={generatedLink || "Click Generate Link first"}
                  />
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    type="button"
                    onClick={handleGenerateLink}
                    disabled={!selectedSurvey || linkLoading}
                  >
                    {linkLoading ? "Generating..." : "Generate Link"}
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    type="button"
                    onClick={handleCopyLink}
                    disabled={!generatedLink}
                  >
                    Copy link
                  </button>
                </div>

                <div className={styles.channelTabs}>
                  <button
                    className={`${styles.channelTab} ${channelTab === "invitation" ? styles.channelTabActive : ""}`}
                    type="button"
                    onClick={() => setChannelTab("invitation")}
                  >
                    Invitation
                  </button>
                  <button
                    className={`${styles.channelTab} ${channelTab === "qr" ? styles.channelTabActive : ""}`}
                    type="button"
                    onClick={() => setChannelTab("qr")}
                  >
                    QR Code
                  </button>
                  <button
                    className={`${styles.channelTab} ${channelTab === "embed" ? styles.channelTabActive : ""}`}
                    type="button"
                    onClick={() => setChannelTab("embed")}
                  >
                    Embed
                  </button>
                </div>

                <div className={styles.channelPanel}>
                  {channelTab === "invitation" ? (
                    <>
                      <div className={styles.channelTopRow}>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>To</label>
                          <input
                            className={styles.input}
                            type="text"
                            value={reminderRecipients}
                            onChange={(event) => setReminderRecipients(event.target.value)}
                            placeholder="People name, Teams group or channel..."
                          />
                        </div>
                        <label className={styles.inlineCheck}>
                          <input
                            type="checkbox"
                            checked={embedCover}
                            onChange={(event) => setEmbedCover(event.target.checked)}
                          />
                          Embed cover
                        </label>
                      </div>
                      <div className={styles.previewCard}>
                        <div className={styles.previewCover}>Cover image</div>
                        <h4>{selectedSurvey?.Title || "Survey title"}</h4>
                        <p>You are invited to complete this survey.</p>
                      </div>
                    </>
                  ) : null}

                  {channelTab === "qr" ? (
                    <div className={styles.qrPlaceholder}>
                      <div className={styles.qrBox}>QR</div>
                      <p>Generate link first, then QR distribution is available.</p>
                    </div>
                  ) : null}

                  {channelTab === "embed" ? (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Embed Snippet</label>
                      <textarea
                        className={styles.textarea}
                        rows={4}
                        readOnly
                        value={
                          generatedLink
                            ? `<iframe src="${generatedLink}" width="100%" height="720" frameborder="0"></iframe>`
                            : "Generate link first to get embed snippet."
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={styles.opsSecondary}>
              <div className={styles.opsBlock}>
                <h3 className={styles.opsBlockTitle}>Blast Schedule</h3>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Mode</label>
                  <select
                    className={styles.select}
                    value={blastMode}
                    onChange={(event) => setBlastMode(event.target.value as "once" | "recurring")}
                  >
                    <option value="once">Once</option>
                    <option value="recurring">Recurring</option>
                  </select>
                </div>

                {blastMode === "once" ? (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Date &amp; Time</label>
                    <input
                      className={styles.input}
                      type="datetime-local"
                      value={blastDateTime}
                      onChange={(event) => setBlastDateTime(event.target.value)}
                    />
                  </div>
                ) : (
                  <div className={styles.scheduleGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Recurring</label>
                      <select
                        className={styles.select}
                        value={blastFrequency}
                        onChange={(event) => setBlastFrequency(event.target.value as "daily" | "weekly" | "monthly")}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Start Date</label>
                      <input
                        className={styles.input}
                        type="date"
                        value={blastStartDate}
                        onChange={(event) => setBlastStartDate(event.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Time</label>
                      <input
                        className={styles.input}
                        type="time"
                        value={blastTime}
                        onChange={(event) => setBlastTime(event.target.value)}
                      />
                    </div>
                    {blastFrequency === "weekly" ? (
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Day of Week</label>
                        <select
                          className={styles.select}
                          value={blastDayOfWeek}
                          onChange={(event) => setBlastDayOfWeek(Number(event.target.value))}
                        >
                          <option value={0}>Sunday</option>
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                        </select>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.label}>Message</label>
                  <textarea
                    className={styles.textarea}
                    value={blastMessage}
                    onChange={(event) => setBlastMessage(event.target.value)}
                    rows={3}
                  />
                </div>
                <button
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.blockButton}`}
                  type="button"
                  onClick={handleSendBlast}
                  disabled={!selectedSurvey || blastLoading}
                >
                  {blastLoading ? "Sending..." : "Send Blast"}
                </button>
              </div>

              <div className={styles.opsBlock}>
                <h3 className={styles.opsBlockTitle}>Reminder</h3>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Mode</label>
                  <select
                    className={styles.select}
                    value={reminderMode}
                    onChange={(event) => setReminderMode(event.target.value as "once" | "recurring")}
                  >
                    <option value="once">Once</option>
                    <option value="recurring">Recurring</option>
                  </select>
                </div>

                {reminderMode === "once" ? (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Date &amp; Time</label>
                    <input
                      className={styles.input}
                      type="datetime-local"
                      value={reminderDateTime}
                      onChange={(event) => setReminderDateTime(event.target.value)}
                    />
                  </div>
                ) : (
                  <div className={styles.scheduleGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Recurring</label>
                      <select
                        className={styles.select}
                        value={reminderFrequency}
                        onChange={(event) =>
                          setReminderFrequency(event.target.value as "daily" | "weekly" | "monthly")
                        }
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Start Date</label>
                      <input
                        className={styles.input}
                        type="date"
                        value={reminderStartDate}
                        onChange={(event) => setReminderStartDate(event.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Time</label>
                      <input
                        className={styles.input}
                        type="time"
                        value={reminderTime}
                        onChange={(event) => setReminderTime(event.target.value)}
                      />
                    </div>
                    {reminderFrequency === "weekly" ? (
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Day of Week</label>
                        <select
                          className={styles.select}
                          value={reminderDayOfWeek}
                          onChange={(event) => setReminderDayOfWeek(Number(event.target.value))}
                        >
                          <option value={0}>Sunday</option>
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                        </select>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.label}>Reminder Message</label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={reminderMessage}
                    onChange={(event) => setReminderMessage(event.target.value)}
                  />
                </div>
                <button
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.blockButton}`}
                  type="button"
                  onClick={handleSendReminder}
                  disabled={!selectedSurvey || reminderLoading}
                >
                  {reminderLoading ? "Sending..." : "Send Reminder"}
                </button>
              </div>
            </div>
          </div>

          {operationFeedback ? <div className={styles.meta}>{operationFeedback}</div> : null}
        </section>
      ) : null}

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











