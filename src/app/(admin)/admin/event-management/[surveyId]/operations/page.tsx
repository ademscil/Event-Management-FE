"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchSurveyById, scheduleEventBlast, scheduleEventReminder } from "@/lib/surveys";
import { generateQRCode, getScheduledOperations, cancelScheduledOperation } from "@/lib/operations";
import Link from "next/link";
import styles from "./operations.module.css";

interface ScheduledOperation {
  ScheduleId: number;
  Type: string;
  ScheduledDate: string;
  Status: string;
  Frequency: string;
  ScheduledTime?: string;
  DayOfWeek?: number;
}

export default function OperationsPage() {
  const params = useParams();
  const surveyId = params.surveyId as string;

  const [loading, setLoading] = useState(true);
  const [surveyTitle, setSurveyTitle] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [operations, setOperations] = useState<ScheduledOperation[]>([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [blastDate, setBlastDate] = useState("");
  const [blastTime, setBlastTime] = useState("");
  const [blastMessage, setBlastMessage] = useState("");
  const [blastRecipients, setBlastRecipients] = useState("");
  const [blastLoading, setBlastLoading] = useState(false);

  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderRecipients, setReminderRecipients] = useState("");
  const [reminderLoading, setReminderLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const result = await fetchSurveyById(surveyId);
      setLoading(false);
      if (!result.success || !result.survey) {
        setError(result.message || "Gagal memuat event");
        return;
      }
      setSurveyTitle(result.survey.Title || "");
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

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `qr-${surveyId}.png`;
    link.click();
  };

  const handleCancel = async (scheduleId: number) => {
    if (!confirm("Yakin ingin cancel operation ini?")) return;
    const result = await cancelScheduledOperation(surveyId, scheduleId);
    if (!result.success) {
      setError(result.message || "Gagal cancel operation");
      return;
    }
    setMessage("Operation berhasil di-cancel");
    await loadOperations();
  };

  const handleScheduleBlast = async () => {
    if (!blastDate || !blastTime || !blastMessage.trim()) {
      setError("Tanggal, waktu, dan message wajib diisi");
      return;
    }
    setBlastLoading(true);
    setError("");
    setMessage("");
    const emailBody = blastRecipients.trim() 
      ? `Recipients: ${blastRecipients.trim()}\n\n${blastMessage.trim()}` 
      : blastMessage.trim();
    const result = await scheduleEventBlast({
      surveyId,
      scheduledDate: new Date(`${blastDate}T${blastTime}`).toISOString(),
      emailTemplate: emailBody,
      embedCover: false,
      frequency: "once",
    });
    setBlastLoading(false);
    if (!result.success) {
      setError(result.message || "Gagal schedule blast");
      return;
    }
    setMessage("Blast berhasil dijadwalkan");
    setBlastDate("");
    setBlastTime("");
    setBlastMessage("");
    setBlastRecipients("");
    await loadOperations();
  };

  const handleScheduleReminder = async () => {
    if (!reminderDate || !reminderTime || !reminderMessage.trim()) {
      setError("Tanggal, waktu, dan message wajib diisi");
      return;
    }
    setReminderLoading(true);
    setError("");
    setMessage("");
    const emailBody = reminderRecipients.trim() 
      ? `Recipients: ${reminderRecipients.trim()}\n\n${reminderMessage.trim()}` 
      : reminderMessage.trim();
    const result = await scheduleEventReminder({
      surveyId,
      scheduledDate: new Date(`${reminderDate}T${reminderTime}`).toISOString(),
      emailTemplate: emailBody,
      embedCover: false,
      frequency: "once",
    });
    setReminderLoading(false);
    if (!result.success) {
      setError(result.message || "Gagal schedule reminder");
      return;
    }
    setMessage("Reminder berhasil dijadwalkan");
    setReminderDate("");
    setReminderTime("");
    setReminderMessage("");
    setReminderRecipients("");
    await loadOperations();
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  };

  const getStatusBadge = (status: string) => {
    if (status === "Pending") return styles.badgePending;
    if (status === "Completed") return styles.badgeCompleted;
    return styles.badgeCancelled;
  };

  if (loading) return <div className={styles.wrapper}>Memuat...</div>;

  return (
    <div className={styles.wrapper}>
      {error ? <div className={`${styles.alert} ${styles.alertError}`}>{error}</div> : null}
      {message ? <div className={`${styles.alert} ${styles.alertSuccess}`}>{message}</div> : null}

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Operational Controls</h1>
          <div className={styles.subtitle}>{surveyTitle}</div>
        </div>
        <Link href="/admin/event-management" className={`${styles.btn} ${styles.btnSecondary}`}>
          Back to Event Management
        </Link>
      </div>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>QR Code</h2>
          <div className={styles.qrSection}>
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code" className={styles.qrImage} />
            ) : (
              <div className={styles.qrPlaceholder}>QR Code belum dibuat</div>
            )}
            <div className={styles.qrActions}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void handleGenerateQR()}
                disabled={qrLoading}
                type="button"
              >
                {qrLoading ? "Generating..." : qrCodeUrl ? "Regenerate" : "Generate QR Code"}
              </button>
              {qrCodeUrl ? (
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={handleDownloadQR}
                  type="button"
                >
                  Download
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Schedule Blast</h2>
          <div className={styles.formGrid}>
            <label>
              Tanggal
              <input type="date" value={blastDate} onChange={(e) => setBlastDate(e.target.value)} className={styles.input} />
            </label>
            <label>
              Waktu
              <input type="time" value={blastTime} onChange={(e) => setBlastTime(e.target.value)} className={styles.input} />
            </label>
          </div>
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
      </section>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Schedule Reminder</h2>
          <div className={styles.formGrid}>
            <label>
              Tanggal
              <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className={styles.input} />
            </label>
            <label>
              Waktu
              <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className={styles.input} />
            </label>
          </div>
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

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Quick Info</h2>
          <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: "1.6" }}>
            <p style={{ margin: "0 0 0.75rem 0" }}><strong>Blast:</strong> Kirim email ke mail list atau semua user</p>
            <p style={{ margin: "0 0 0.75rem 0" }}><strong>Reminder:</strong> Kirim email follow-up ke recipients tertentu</p>
            <p style={{ margin: "0 0 0.75rem 0" }}><strong>Recipients:</strong> Kosongkan untuk kirim ke semua user di database</p>
            <p style={{ margin: "0" }}><strong>QR Code:</strong> Untuk distribusi survey secara offline</p>
          </div>
        </div>
      </section>

      <section className={styles.panelFull}>
        <h2 className={styles.panelTitle}>Scheduled Operations</h2>
        {opsLoading ? (
          <div className={styles.empty}>Memuat...</div>
        ) : operations.length === 0 ? (
          <div className={styles.empty}>Belum ada scheduled operations</div>
        ) : (
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
              {operations.map((op) => (
                <tr key={op.ScheduleId}>
                  <td>{op.Type}</td>
                  <td>{formatDate(op.ScheduledDate)}</td>
                  <td>{op.Frequency}</td>
                  <td>
                    <span className={`${styles.badge} ${getStatusBadge(op.Status)}`}>
                      {op.Status}
                    </span>
                  </td>
                  <td>
                    {op.Status === "Pending" ? (
                      <button
                        className={styles.actionBtn}
                        onClick={() => void handleCancel(op.ScheduleId)}
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
        )}
      </section>
    </div>
  );
}






