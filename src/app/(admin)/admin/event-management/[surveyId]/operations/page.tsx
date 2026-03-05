"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchSurveyById, generateEventLink, scheduleEventBlast, scheduleEventReminder, type ScheduleFrequency } from "@/lib/surveys";
import { generateQRCode, getScheduledOperations, cancelScheduledOperation } from "@/lib/operations";
import Link from "next/link";
import Image from "next/image";
import { Dropdown } from "@/components/common/dropdown";
import styles from "./operations.module.css";

interface ScheduledOperation {
  operationId: string;
  operationType: string;
  frequency: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  dayOfWeek?: number | null;
  status: string;
}

type ShareTab = "invite" | "qr" | "embed";
type DayOfWeekValue = "0" | "1" | "2" | "3" | "4" | "5" | "6";

const frequencyOptions: { label: string; value: ScheduleFrequency }[] = [
  { label: "Once", value: "once" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

const dayOfWeekOptions: { label: string; value: DayOfWeekValue }[] = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

export default function OperationsPage() {
  const params = useParams();
  const surveyId = params.surveyId as string;

  const [loading, setLoading] = useState(true);
  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyLink, setSurveyLink] = useState("");
  const [shortenedLink, setShortenedLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [operations, setOperations] = useState<ScheduledOperation[]>([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [shareTab, setShareTab] = useState<ShareTab>("invite");
  const [shortenUrl, setShortenUrl] = useState(false);

  const [blastDate, setBlastDate] = useState("");
  const [blastTime, setBlastTime] = useState("");
  const [blastFrequency, setBlastFrequency] = useState<ScheduleFrequency>("once");
  const [blastDayOfWeek, setBlastDayOfWeek] = useState<DayOfWeekValue>("1");
  const [blastSubject, setBlastSubject] = useState("");
  const [blastIncludeQrCode, setBlastIncludeQrCode] = useState(false);
  const [blastMessage, setBlastMessage] = useState("");
  const [blastRecipients, setBlastRecipients] = useState("");
  const [blastLoading, setBlastLoading] = useState(false);

  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderFrequency, setReminderFrequency] = useState<ScheduleFrequency>("once");
  const [reminderDayOfWeek, setReminderDayOfWeek] = useState<DayOfWeekValue>("1");
  const [reminderSubject, setReminderSubject] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderRecipients, setReminderRecipients] = useState("");
  const [reminderLoading, setReminderLoading] = useState(false);
  const [openInfoPanel, setOpenInfoPanel] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ScheduledOperation | null>(null);

  const parseRecipients = (value: string): string[] => (
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validateScheduleInput = (input: {
    date: string;
    time: string;
    frequency: ScheduleFrequency;
    subject: string;
    messageText: string;
    recipients: string[];
    dayOfWeek?: DayOfWeekValue;
  }): string | null => {
    if (!input.date || !input.time || !input.subject.trim() || !input.messageText.trim()) {
      return "Tanggal, waktu, subject, dan message wajib diisi";
    }

    if (input.frequency === "weekly" && (input.dayOfWeek === undefined || input.dayOfWeek === null)) {
      return "Hari wajib diisi untuk recurring mingguan";
    }

    const invalidRecipients = input.recipients.filter((email) => !isValidEmail(email));
    if (invalidRecipients.length > 0) {
      return `Format email tidak valid: ${invalidRecipients[0]}`;
    }

    const now = new Date();
    const scheduleDate = new Date(`${input.date}T${input.time}:00`);
    if (Number.isNaN(scheduleDate.getTime())) {
      return "Format tanggal/waktu tidak valid";
    }

    if (input.frequency === "once" && scheduleDate <= now) {
      return "Jadwal once harus lebih besar dari waktu saat ini";
    }

    const startDateOnly = new Date(`${input.date}T00:00:00`);
    const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (input.frequency !== "once" && startDateOnly < todayDateOnly) {
      return "Start date recurring tidak boleh di masa lalu";
    }

    return null;
  };

  useEffect(() => {
    const load = async () => {
      const result = await fetchSurveyById(surveyId);
      setLoading(false);
      if (!result.success || !result.survey) {
        setError(result.message || "Gagal memuat event");
        return;
      }
      setSurveyTitle(result.survey.Title || "");
      setSurveyLink(result.survey.SurveyLink || "");
      setShortenedLink(result.survey.ShortenedLink || "");
      setQrCodeUrl(result.survey.QRCodeDataUrl || "");
      setOpsLoading(true);
      const opsResult = await getScheduledOperations(surveyId);
      setOpsLoading(false);
      if (opsResult.success && opsResult.operations) {
        setOperations(opsResult.operations);
      }
    };
    void load();
  }, [surveyId]);

  async function loadOperations() {
    setOpsLoading(true);
    const result = await getScheduledOperations(surveyId);
    setOpsLoading(false);
    if (result.success && result.operations) {
      setOperations(result.operations);
    }
  };

  const handleGenerateQR = async () => {
    setQrLoading(true);
    setError("");
    setMessage("");
    const result = await generateQRCode(surveyId);
    setQrLoading(false);
    if (!result.success) {
      setError(result.message || "Gagal generate QR code");
      return;
    }
    setQrCodeUrl(result.qrCodeUrl || "");
    setMessage("QR Code berhasil dibuat");
  };

  const handleGenerateLink = async (useShorten: boolean) => {
    setLinkLoading(true);
    setError("");
    setMessage("");
    const result = await generateEventLink(surveyId, useShorten);
    setLinkLoading(false);
    if (!result.success) {
      setError(result.message || "Gagal generate link survey");
      return;
    }

    setSurveyLink(result.surveyLink || "");
    setShortenedLink(result.shortenedLink || "");
    setMessage(useShorten ? "Short link berhasil dibuat" : "Link survey berhasil dibuat");
  };

  const copyToClipboard = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} berhasil disalin`);
      setError("");
    } catch {
      setError(`Gagal menyalin ${label.toLowerCase()}`);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `qr-${surveyId}.png`;
    link.click();
  };

  const handleCancel = async (operationId: string) => {
    const result = await cancelScheduledOperation(surveyId, operationId);
    if (!result.success) {
      setError(result.message || "Gagal cancel operation");
      return;
    }
    setMessage("Operation berhasil di-cancel");
    setCancelTarget(null);
    await loadOperations();
  };

  const handleScheduleBlast = async () => {
    const recipientEmails = parseRecipients(blastRecipients);
    const validationError = validateScheduleInput({
      date: blastDate,
      time: blastTime,
      frequency: blastFrequency,
      subject: blastSubject,
      messageText: blastMessage,
      recipients: recipientEmails,
      dayOfWeek: blastFrequency === "weekly" ? blastDayOfWeek : undefined,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    setBlastLoading(true);
    setError("");
    setMessage("");

    const localScheduleDateTime = blastFrequency === "once" ? `${blastDate}T${blastTime}:00` : `${blastDate}T00:00:00`;
    const result = await scheduleEventBlast({
      surveyId,
      scheduledDate: localScheduleDateTime,
      emailTemplate: "survey-invitation",
      customSubject: blastSubject.trim(),
      customMessage: blastMessage.trim(),
      includeQrCode: blastIncludeQrCode,
      recipientEmails,
      embedCover: false,
      frequency: blastFrequency,
      scheduledTime: blastFrequency === "once" ? undefined : blastTime,
      dayOfWeek: blastFrequency === "weekly" ? Number(blastDayOfWeek) : undefined,
    });
    setBlastLoading(false);
    if (!result.success) {
      setError(result.message || "Gagal schedule blast");
      return;
    }
    setMessage("Blast berhasil dijadwalkan");
    setBlastDate("");
    setBlastTime("");
    setBlastFrequency("once");
    setBlastDayOfWeek("1");
    setBlastSubject("");
    setBlastIncludeQrCode(false);
    setBlastMessage("");
    setBlastRecipients("");
    await loadOperations();
  };

  const handleScheduleReminder = async () => {
    const recipientEmails = parseRecipients(reminderRecipients);
    const validationError = validateScheduleInput({
      date: reminderDate,
      time: reminderTime,
      frequency: reminderFrequency,
      subject: reminderSubject,
      messageText: reminderMessage,
      recipients: recipientEmails,
      dayOfWeek: reminderFrequency === "weekly" ? reminderDayOfWeek : undefined,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    setReminderLoading(true);
    setError("");
    setMessage("");

    const localScheduleDateTime = reminderFrequency === "once" ? `${reminderDate}T${reminderTime}:00` : `${reminderDate}T00:00:00`;
    const result = await scheduleEventReminder({
      surveyId,
      scheduledDate: localScheduleDateTime,
      emailTemplate: "survey-reminder",
      customSubject: reminderSubject.trim(),
      customMessage: reminderMessage.trim(),
      recipientEmails,
      embedCover: false,
      frequency: reminderFrequency,
      scheduledTime: reminderFrequency === "once" ? undefined : reminderTime,
      dayOfWeek: reminderFrequency === "weekly" ? Number(reminderDayOfWeek) : undefined,
    });
    setReminderLoading(false);
    if (!result.success) {
      setError(result.message || "Gagal schedule reminder");
      return;
    }
    setMessage("Reminder berhasil dijadwalkan");
    setReminderDate("");
    setReminderTime("");
    setReminderFrequency("once");
    setReminderDayOfWeek("1");
    setReminderSubject("");
    setReminderMessage("");
    setReminderRecipients("");
    await loadOperations();
  };

  const formatDate = (date?: string | null, time?: string | null) => {
    const raw = date || "";
    if (!raw) return "-";
    const d = time ? new Date(`${raw}T${time}`) : new Date(raw);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  };

  const getStatusBadge = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "pending") return styles.badgePending;
    if (normalized === "completed") return styles.badgeCompleted;
    if (normalized === "failed") return styles.badgeFailed;
    return styles.badgeCancelled;
  };

  if (loading) return <div className={styles.wrapper}>Memuat...</div>;

  const toggleInfoPanel = (panelId: string) => {
    setOpenInfoPanel((prev) => (prev === panelId ? null : panelId));
  };

  const effectiveLink = shortenUrl && shortenedLink ? shortenedLink : surveyLink;
  const embedCode = effectiveLink
    ? `<iframe width="640" height="480" src="${effectiveLink}" frameborder="0" marginwidth="0" marginheight="0" style="border:none; max-width:100%; max-height:100vh" allowfullscreen webkitallowfullscreen mozallowfullscreen msallowfullscreen> </iframe>`
    : "";

  return (
    <div className={styles.wrapper}>
      <div aria-live="polite">
        {error ? <div className={`${styles.alert} ${styles.alertError}`}>{error}</div> : null}
        {message ? <div className={`${styles.alert} ${styles.alertSuccess}`}>{message}</div> : null}
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Operational Controls</h1>
          <div className={styles.subtitle}>{surveyTitle}</div>
        </div>
        <Link href="/admin/event-management" className={`${styles.btn} ${styles.btnSecondary} ${styles.headerBackButton}`}>
          Back to Event Management
        </Link>
      </div>

      <section className={styles.panelFull}>
        <div className={styles.panelHeading}>
          <h2 className={styles.panelTitle}>Share Survey</h2>
          <button
            type="button"
            className={styles.infoButton}
            onClick={() => toggleInfoPanel("share")}
            aria-label="Info Share Survey"
          >
            i
          </button>
        </div>
        {openInfoPanel === "share" ? (
          <div className={styles.infoText}>Pilih mode Invite, QR, atau Embed untuk distribusi link survey.</div>
        ) : null}

        <div className={styles.shareTabs}>
          <button type="button" className={`${styles.tabButton} ${shareTab === "invite" ? styles.tabButtonActive : ""}`} onClick={() => setShareTab("invite")}>
            Invite
          </button>
          <button type="button" className={`${styles.tabButton} ${shareTab === "qr" ? styles.tabButtonActive : ""}`} onClick={() => setShareTab("qr")}>
            QR Code
          </button>
          <button type="button" className={`${styles.tabButton} ${shareTab === "embed" ? styles.tabButtonActive : ""}`} onClick={() => setShareTab("embed")}>
            Embed
          </button>
        </div>

        {shareTab === "invite" ? (
          <div className={styles.shareBody}>
            <div className={styles.linkRow}>
              <input className={styles.input} readOnly value={effectiveLink} placeholder="Link survey belum dibuat" />
              <button className={`${styles.btn} ${styles.btnPrimary} ${styles.linkActionButton}`} type="button" disabled={!effectiveLink} onClick={() => void copyToClipboard(effectiveLink, "Link survey")}>
                Copy Link
              </button>
            </div>
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={shortenUrl} onChange={(e) => setShortenUrl(e.target.checked)} />
              Shorten URL
            </label>
            <div className={styles.linkActions}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" disabled={linkLoading} onClick={() => void handleGenerateLink(shortenUrl)}>
                {linkLoading ? "Generating..." : shortenUrl ? "Generate Short Link" : "Generate Link"}
              </button>
            </div>
          </div>
        ) : null}

        {shareTab === "qr" ? (
          <div className={styles.shareBody}>
            <div className={styles.qrSection}>
              {qrCodeUrl ? (
                <Image src={qrCodeUrl} alt="QR Code" width={220} height={220} className={styles.qrImage} unoptimized />
              ) : (
                <div className={styles.qrPlaceholder}>QR Code belum dibuat</div>
              )}
            </div>
            <div className={styles.linkActions}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => void handleGenerateQR()} disabled={qrLoading} type="button">
                {qrLoading ? "Generating..." : qrCodeUrl ? "Regenerate QR" : "Generate QR"}
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleDownloadQR} disabled={!qrCodeUrl} type="button">
                Download
              </button>
            </div>
          </div>
        ) : null}

        {shareTab === "embed" ? (
          <div className={styles.shareBody}>
            <textarea className={styles.embedCode} readOnly value={embedCode} placeholder="Generate link terlebih dahulu untuk membuat embed code." />
            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.embedCopyBtn}`} type="button" disabled={!embedCode} onClick={() => void copyToClipboard(embedCode, "Embed code")}>
              Copy
            </button>
          </div>
        ) : null}
      </section>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <h2 className={styles.panelTitle}>Schedule Blast</h2>
            <button
              type="button"
              className={styles.infoButton}
              onClick={() => toggleInfoPanel("blast")}
              aria-label="Info Schedule Blast"
            >
              i
            </button>
          </div>
          {openInfoPanel === "blast" ? (
            <div className={styles.infoText}>Blast mengirim undangan survey pertama ke target penerima.</div>
          ) : null}
          <label className={styles.formLabel}>
            Frequency
            <Dropdown
              className={styles.input}
              options={frequencyOptions}
              value={blastFrequency}
              onChange={(value) => setBlastFrequency(value as ScheduleFrequency)}
              fullWidth
            />
          </label>
          {blastFrequency === "weekly" ? (
            <label className={styles.formLabel}>
              Hari Kirim (Weekly)
              <Dropdown
                className={styles.input}
                options={dayOfWeekOptions}
                value={blastDayOfWeek}
                onChange={(value) => setBlastDayOfWeek(value as DayOfWeekValue)}
                fullWidth
              />
            </label>
          ) : null}
          {blastFrequency === "monthly" ? <div className={styles.infoText}>Monthly akan dijalankan pada tanggal start date setiap bulan, di waktu yang dipilih.</div> : null}
          <div className={styles.formGrid}>
            <label>
              {blastFrequency === "once" ? "Tanggal" : "Start Date"}
              <input type="date" value={blastDate} onChange={(e) => setBlastDate(e.target.value)} className={styles.input} />
            </label>
            <label>
              {blastFrequency === "once" ? "Waktu" : "Schedule Time"}
              <input type="time" value={blastTime} onChange={(e) => setBlastTime(e.target.value)} className={styles.input} />
            </label>
          </div>
          <label className={styles.formLabel}>
            Email Subject
            <input type="text" value={blastSubject} onChange={(e) => setBlastSubject(e.target.value)} className={styles.input} placeholder="Contoh: Undangan Survey IT Maret 2026" />
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={blastIncludeQrCode}
              onChange={(event) => setBlastIncludeQrCode(event.target.checked)}
            />
            Lampirkan QR Code di email blast
          </label>
          <label className={styles.formLabel}>
            Email Recipients (opsional)
            <input type="text" value={blastRecipients} onChange={(e) => setBlastRecipients(e.target.value)} className={styles.input} placeholder="email1@example.com, email2@example.com" />
          </label>
          <label className={styles.formLabel}>
            Email Message
            <textarea value={blastMessage} onChange={(e) => setBlastMessage(e.target.value)} className={styles.textarea} rows={3} placeholder="Tulis pesan email blast..." />
          </label>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void handleScheduleBlast()} disabled={blastLoading} type="button">
            {blastLoading ? "Scheduling..." : "Schedule Blast"}
          </button>
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <h2 className={styles.panelTitle}>Schedule Reminder</h2>
            <button
              type="button"
              className={styles.infoButton}
              onClick={() => toggleInfoPanel("reminder")}
              aria-label="Info Schedule Reminder"
            >
              i
            </button>
          </div>
          {openInfoPanel === "reminder" ? (
            <div className={styles.infoText}>Reminder dipakai untuk follow-up responden yang belum mengisi.</div>
          ) : null}
          <label className={styles.formLabel}>
            Frequency
            <Dropdown
              className={styles.input}
              options={frequencyOptions}
              value={reminderFrequency}
              onChange={(value) => setReminderFrequency(value as ScheduleFrequency)}
              fullWidth
            />
          </label>
          {reminderFrequency === "weekly" ? (
            <label className={styles.formLabel}>
              Hari Kirim (Weekly)
              <Dropdown
                className={styles.input}
                options={dayOfWeekOptions}
                value={reminderDayOfWeek}
                onChange={(value) => setReminderDayOfWeek(value as DayOfWeekValue)}
                fullWidth
              />
            </label>
          ) : null}
          {reminderFrequency === "monthly" ? <div className={styles.infoText}>Monthly akan dijalankan pada tanggal start date setiap bulan, di waktu yang dipilih.</div> : null}
          <div className={styles.formGrid}>
            <label>
              {reminderFrequency === "once" ? "Tanggal" : "Start Date"}
              <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className={styles.input} />
            </label>
            <label>
              {reminderFrequency === "once" ? "Waktu" : "Schedule Time"}
              <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className={styles.input} />
            </label>
          </div>
          <label className={styles.formLabel}>
            Email Subject
            <input type="text" value={reminderSubject} onChange={(e) => setReminderSubject(e.target.value)} className={styles.input} placeholder="Contoh: Reminder Survey IT Maret 2026" />
          </label>
          <label className={styles.formLabel}>
            Email Recipients (opsional)
            <input type="text" value={reminderRecipients} onChange={(e) => setReminderRecipients(e.target.value)} className={styles.input} placeholder="email1@example.com, email2@example.com" />
          </label>
          <label className={styles.formLabel}>
            Email Message
            <textarea value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} className={styles.textarea} rows={3} placeholder="Tulis pesan reminder..." />
          </label>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void handleScheduleReminder()} disabled={reminderLoading} type="button">
            {reminderLoading ? "Scheduling..." : "Schedule Reminder"}
          </button>
        </div>
      </section>

      <section className={styles.panelFull}>
        <h2 className={styles.panelTitle}>Scheduled Operations</h2>
        {opsLoading ? (
          <div className={styles.empty}>Memuat...</div>
        ) : operations.length === 0 ? (
          <div className={styles.empty}>Belum ada scheduled operations</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Scheduled Date</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op, index) => (
                  <tr key={op.operationId || `${op.operationType}-${op.scheduledDate}-${index}`}>
                    <td>{op.operationType || "-"}</td>
                    <td>{formatDate(op.scheduledDate, op.scheduledTime)}</td>
                    <td>{op.frequency || "-"}</td>
                    <td>
                      <span className={`${styles.badge} ${getStatusBadge(op.status)}`}>
                        {op.status || "-"}
                      </span>
                    </td>
                    <td>
                      {String(op.status || "").toLowerCase() === "pending" ? (
                        <button
                          className={styles.actionBtn}
                          onClick={() => setCancelTarget(op)}
                          type="button"
                        >
                          Cancel
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {cancelTarget ? (
        <div className={styles.modalOverlay} onClick={() => setCancelTarget(null)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Cancel Scheduled Operation</h3>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                Yakin ingin membatalkan {cancelTarget.operationType || "operation"} yang dijadwalkan pada{" "}
                {formatDate(cancelTarget.scheduledDate, cancelTarget.scheduledTime)}?
              </p>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setCancelTarget(null)}>
                Batal
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void handleCancel(cancelTarget.operationId)}>
                Ya, Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}






