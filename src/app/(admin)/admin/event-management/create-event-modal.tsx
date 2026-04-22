"use client";

import type { AdminEventUser } from "@/lib/users";
import styles from "../page-mockup.module.css";

interface CreateEventModalProps {
  adminEventInput: string;
  adminEventSuggestions: AdminEventUser[];
  applyAdminSelection: (user: AdminEventUser) => void;
  closeModal: () => void;
  draftDescription: string;
  draftName: string;
  eventType: "survey" | null;
  handleCreateDraft: () => Promise<void>;
  removeAdminSelection: (userId: string) => void;
  selectedAdminEvents: AdminEventUser[];
  setAdminEventInput: (value: string) => void;
  setDraftDescription: (value: string) => void;
  setDraftName: (value: string) => void;
  setEventType: (value: "survey") => void;
  setShowAdminSuggestion: (value: boolean) => void;
  showAdminSuggestion: boolean;
  showCreateModal: boolean;
  submitting: boolean;
  submitLabel?: string;
  title?: string;
}

export default function CreateEventModal(props: CreateEventModalProps) {
  const {
    adminEventInput,
    adminEventSuggestions,
    applyAdminSelection,
    closeModal,
    draftDescription,
    draftName,
    eventType,
    handleCreateDraft,
    removeAdminSelection,
    selectedAdminEvents,
    setAdminEventInput,
    setDraftDescription,
    setDraftName,
    setEventType,
    setShowAdminSuggestion,
    showAdminSuggestion,
    showCreateModal,
    submitting,
    submitLabel,
    title,
  } = props;

  if (!showCreateModal) return null;

  return (
    <div className={styles.modalOverlay} onClick={closeModal} role="presentation">
      <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create Event">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title || (eventType ? "Create Survey Event" : "Select Event Type")}</h2>
          <button className={styles.modalClose} onClick={closeModal} type="button" aria-label="Close">
            x
          </button>
        </div>
        <div className={styles.modalBody}>
          {!eventType ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>Pilih tipe event yang akan dibuat:</p>
              <button
                type="button"
                onClick={() => setEventType("survey")}
                style={{ padding: "16px 20px", border: "2px solid #e5e7eb", borderRadius: "10px", background: "#ffffff", cursor: "pointer", textAlign: "left" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2f55d4";
                  e.currentTarget.style.background = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "4px" }}>Forms / Survey</div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>Buat event survey untuk mengumpulkan feedback dari responden</div>
              </button>
              <button
                type="button"
                disabled
                style={{ padding: "16px 20px", border: "2px solid #e5e7eb", borderRadius: "10px", background: "#f9fafb", cursor: "not-allowed", textAlign: "left", opacity: 0.5 }}
              >
                <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "4px" }}>Other Event Types</div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>Coming soon...</div>
              </button>
            </div>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="surveyName">Survey Name *</label>
                <input id="surveyName" name="surveyName" className={styles.input} value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="e.g. Survey Corp IT & BPM 2026" type="text" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="surveyAdminEvent">Admin Event Target *</label>
                <div className={styles.chipInputWrap}>
                  {selectedAdminEvents.map((user) => (
                    <span key={user.UserId} className={styles.chip}>
                      {user.DisplayName}
                      <button className={styles.chipRemove} onClick={() => removeAdminSelection(user.UserId)} type="button" aria-label={`Remove ${user.DisplayName}`}>
                        x
                      </button>
                    </span>
                  ))}
                  <input
                    id="surveyAdminEvent"
                    name="surveyAdminEvent"
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
                    placeholder={selectedAdminEvents.length === 0 ? "Cari Admin Event" : "Tambah Admin Event"}
                    type="text"
                    autoComplete="off"
                  />
                </div>
                {showAdminSuggestion && adminEventSuggestions.length > 0 ? (
                  <div className={styles.suggestionMenu}>
                    {adminEventSuggestions.map((user) => (
                      <button key={user.UserId} className={styles.suggestionItem} onClick={() => applyAdminSelection(user)} type="button">
                        <span>{user.DisplayName}</span>
                        <span className={styles.suggestionMeta}>{user.Email}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="surveyDesc">Description</label>
                <textarea id="surveyDesc" name="surveyDesc" className={styles.textarea} value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder="Jelaskan tujuan survey secara singkat" rows={3} />
              </div>
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={closeModal} type="button">Cancel</button>
          {eventType ? (
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void handleCreateDraft()} disabled={submitting} type="button">
              {submitting ? "Saving..." : (submitLabel || "Create")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
