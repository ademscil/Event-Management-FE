"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchSurveyById, generateEventLink, scheduleEventBlast, scheduleEventReminder, type ScheduleFrequency } from "@/lib/surveys";
import { generateQRCode, getScheduledOperations, cancelScheduledOperation } from "@/lib/operations";
import Link from "next/link";
import Image from "next/image";
import { Dropdown } from "@/components/common/dropdown";
import styles from "./operations.module.css";
import CancelScheduledOperationDialog from "./cancel-scheduled-operation-dialog";
import {
  formatOperationDate,
  getStatusBadge,
  parseRecipients,
  toDownloadFileStem,
  validateScheduleInput,
  type DayOfWeekValue,
  type ScheduledOperation,
} from "./operations-utils";

type ShareTab = "invite" | "qr" | "embed";

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
  const [emailTab, setEmailTab] = useState<"blast" | "reminder">("blast");

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
    link.download = `qr-${toDownloadFileStem(surveyTitle, "survey")}.png`;
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

      <section className={styles.panelFull}>
        {/* Tab switcher */}
        <div className={styles.emailTabBar}>
          <button
            type="button"
            className={`${styles.emailTab} ${emailTab === "blast" ? styles.emailTabActive : ""}`}
            onClick={() => setEmailTab("blast")}
          >
            📧 Schedule Blast
          </button>
          <button
            type="button"
            className={`${styles.emailTab} ${emailTab === "reminder" ? styles.emailTabActive : ""}`}
            onClick={() => setEmailTab("reminder")}
          >
            🔔 Schedule Reminder
          </button>
        </div>

        {/* ── Blast ── */}
        {emailTab === "blast" ? (
          <div className={styles.emailForm}>
            <p className={styles.emailFormDesc}>Kirim undangan survey pertama ke target penerima</p>

            <div className={styles.emailFormGrid}>
              {/* Kolom kiri */}
              <div className={styles.emailFormCol}>
                <div className={styles.formSection}>
                  <div className={styles.formSectionTitle}>Jadwal Pengiriman</div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="blast-freq">Frekuensi</label>
                    <Dropdown
                      className={styles.input}
                      options={frequencyOptions}
                      value={blastFrequency}
                      onChange={(value) => setBlastFrequency(value as ScheduleFrequency)}
                      fullWidth
                    />
                  </div>
                  {blastFrequency === "weekly" ? (
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Hari Kirim</label>
                      <Dropdown
                        className={styles.input}
                        options={dayOfWeekOptions}
                        value={blastDayOfWeek}
                        onChange={(value) => setBlastDayOfWeek(value as DayOfWeekValue)}
                        fullWidth
                      />
                    </div>
                  ) : null}
                  {blastFrequency === "monthly" ? (
                    <div className={styles.infoChip}>ℹ️ Dikirim setiap bulan pada tanggal start date</div>
                  ) : null}
                  <div className={styles.formRow2}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="blast-date">
                        {blastFrequency === "once" ? "Tanggal" : "Start Date"}
                      </label>
                      <input id="blast-date" type="date" value={blastDate} onChange={(e) => setBlastDate(e.target.value)} className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="blast-time">
                        {blastFrequency === "once" ? "Waktu" : "Jam Kirim"}
                      </label>
                      <input id="blast-time" type="time" value={blastTime} onChange={(e) => setBlastTime(e.target.value)} className={styles.input} />
                    </div>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <div className={styles.formSectionTitle}>Penerima</div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="blast-recipients">
                      Email Penerima
                      <span className={styles.fieldHint}> — pisahkan dengan koma. Kosongkan untuk kirim ke semua responden terdaftar.</span>
                    </label>
                    <textarea
                      id="blast-recipients"
                      value={blastRecipients}
                      onChange={(e) => setBlastRecipients(e.target.value)}
                      className={styles.textarea}
                      rows={3}
                      placeholder="email1@astraotoparts.co.id, email2@astraotoparts.co.id"
                    />
                  </div>
                </div>
              </div>

              {/* Kolom kanan */}
              <div className={styles.emailFormCol}>
                <div className={styles.formSection}>
                  <div className={styles.formSectionTitle}>Konten Email</div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="blast-subject">Subject Email</label>
                    <input id="blast-subject" type="text" value={blastSubject} onChange={(e) => setBlastSubject(e.target.value)} className={styles.input} placeholder="Contoh: Undangan Survey IT 2026" />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="blast-msg">Pesan Email</label>
                    <textarea id="blast-msg" value={blastMessage} onChange={(e) => setBlastMessage(e.target.value)} className={styles.textarea} rows={5} placeholder={"Contoh:\nBapak/Ibu yang kami hormati,\n\nKami mengundang Anda untuk berpartisipasi pada survey kepuasan IT 2026.\n\nTerima kasih atas partisipasi Anda."} />
                    <span className={styles.fieldHint}>Kosongkan untuk menggunakan teks default. Isi untuk mengganti seluruh isi pesan email.</span>
                  </div>
                  <label className={styles.checkboxRow}>
                    <input type="checkbox" checked={blastIncludeQrCode} onChange={(e) => setBlastIncludeQrCode(e.target.checked)} />
                    Lampirkan QR Code di email
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.emailFormFooter}>
              <button
                className={`${styles.btn} ${styles.btnPrimary} ${styles.emailSubmitBtn}`}
                onClick={() => void handleScheduleBlast()}
                disabled={blastLoading}
                type="button"
              >
                {blastLoading ? "Menjadwalkan..." : "🚀 Schedule Blast"}
              </button>
            </div>
          </div>
        ) : null}

        {/* ── Reminder ── */}
        {emailTab === "reminder" ? (
          <div className={styles.emailForm}>
            <p className={styles.emailFormDesc}>Follow-up responden yang belum mengisi survey</p>

            <div className={styles.emailFormGrid}>
              {/* Kolom kiri */}
              <div className={styles.emailFormCol}>
                <div className={styles.formSection}>
                  <div className={styles.formSectionTitle}>Jadwal Pengiriman</div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="rem-freq">Frekuensi</label>
                    <Dropdown
                      className={styles.input}
                      options={frequencyOptions}
                      value={reminderFrequency}
                      onChange={(value) => setReminderFrequency(value as ScheduleFrequency)}
                      fullWidth
                    />
                  </div>
                  {reminderFrequency === "weekly" ? (
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Hari Kirim</label>
                      <Dropdown
                        className={styles.input}
                        options={dayOfWeekOptions}
                        value={reminderDayOfWeek}
                        onChange={(value) => setReminderDayOfWeek(value as DayOfWeekValue)}
                        fullWidth
                      />
                    </div>
                  ) : null}
                  {reminderFrequency === "monthly" ? (
                    <div className={styles.infoChip}>ℹ️ Dikirim setiap bulan pada tanggal start date</div>
                  ) : null}
                  <div className={styles.formRow2}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="rem-date">
                        {reminderFrequency === "once" ? "Tanggal" : "Start Date"}
                      </label>
                      <input id="rem-date" type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className={styles.input} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel} htmlFor="rem-time">
                        {reminderFrequency === "once" ? "Waktu" : "Jam Kirim"}
                      </label>
                      <input id="rem-time" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className={styles.input} />
                    </div>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <div className={styles.formSectionTitle}>Penerima</div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="rem-recipients">
                      Email Penerima
                      <span className={styles.fieldHint}> — pisahkan dengan koma. Kosongkan untuk kirim ke semua non-responden.</span>
                    </label>
                    <textarea
                      id="rem-recipients"
                      value={reminderRecipients}
                      onChange={(e) => setReminderRecipients(e.target.value)}
                      className={styles.textarea}
                      rows={3}
                      placeholder="email1@astraotoparts.co.id, email2@astraotoparts.co.id"
                    />
                  </div>
                </div>
              </div>

              {/* Kolom kanan */}
              <div className={styles.emailFormCol}>
                <div className={styles.formSection}>
                  <div className={styles.formSectionTitle}>Konten Email</div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="rem-subject">Subject Email</label>
                    <input id="rem-subject" type="text" value={reminderSubject} onChange={(e) => setReminderSubject(e.target.value)} className={styles.input} placeholder="Contoh: Reminder Survey IT 2026" />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="rem-msg">Pesan Email</label>
                    <textarea id="rem-msg" value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} className={styles.textarea} rows={5} placeholder={"Contoh:\nYth. Bapak/Ibu,\n\nIni adalah pengingat bahwa survey akan segera berakhir.\nMohon segera isi sebelum batas waktu.\n\nTerima kasih."} />
                    <span className={styles.fieldHint}>Kosongkan untuk menggunakan teks default. Isi untuk mengganti seluruh isi pesan email.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.emailFormFooter}>
              <button
                className={`${styles.btn} ${styles.btnPrimary} ${styles.emailSubmitBtn}`}
                onClick={() => void handleScheduleReminder()}
                disabled={reminderLoading}
                type="button"
              >
                {reminderLoading ? "Menjadwalkan..." : "🔔 Schedule Reminder"}
              </button>
            </div>
          </div>
        ) : null}
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
                    <td>{formatOperationDate(op.scheduledDate, op.scheduledTime)}</td>
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

      <CancelScheduledOperationDialog
        cancelTarget={cancelTarget}
        onCancel={() => setCancelTarget(null)}
        onConfirm={(operationId) => {
          void handleCancel(operationId);
        }}
      />
    </div>
  );
}






