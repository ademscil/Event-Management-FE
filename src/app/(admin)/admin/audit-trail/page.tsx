"use client";

import { Dropdown } from "@/components/common/dropdown";
import { getCurrentUser } from "@/lib/auth";
import { fetchAuditLogs, type AuditLogItem } from "@/lib/audit";
import type { UserRole } from "@/types/auth";
import { useEffect, useMemo, useState } from "react";
import baseStyles from "../page-mockup.module.css";
import styles from "./audit-trail.module.css";

const ACTION_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "Create", label: "Create" },
  { value: "Update", label: "Update" },
  { value: "Delete", label: "Delete" },
  { value: "Access", label: "Access" },
  { value: "Login", label: "Login" },
  { value: "Logout", label: "Logout" },
  { value: "LoginFailed", label: "Login Failed" },
  { value: "Approve", label: "Approve" },
  { value: "Reject", label: "Reject" },
  { value: "Export", label: "Export" },
];

type ModalState =
  | { type: "none" }
  | { type: "detail"; item: AuditLogItem };

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function badgeClass(action: string): string {
  switch (action) {
    case "Create":
      return `${styles.badge} ${styles.badgeCreate}`;
    case "Update":
      return `${styles.badge} ${styles.badgeUpdate}`;
    case "Delete":
      return `${styles.badge} ${styles.badgeDelete}`;
    case "Access":
      return `${styles.badge} ${styles.badgeAccess}`;
    case "Login":
      return `${styles.badge} ${styles.badgeLogin}`;
    case "Logout":
      return `${styles.badge} ${styles.badgeLogout}`;
    case "LoginFailed":
      return `${styles.badge} ${styles.badgeLoginFailed}`;
    case "Approve":
      return `${styles.badge} ${styles.badgeApprove}`;
    case "Reject":
      return `${styles.badge} ${styles.badgeReject}`;
    case "Export":
      return `${styles.badge} ${styles.badgeExport}`;
    default:
      return `${styles.badge} ${styles.badgeDefault}`;
  }
}

export default function AuditTrailPage() {
  const user = getCurrentUser();
  const role: UserRole | null = user?.role ?? null;
  const canAccess = role === "SuperAdmin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  const [usernameFilter, setUsernameFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedUsername, setAppliedUsername] = useState("");
  const [appliedEntityType, setAppliedEntityType] = useState("all");
  const [appliedAction, setAppliedAction] = useState("all");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  const entityTypeOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((item) => String(item.EntityType || "").trim()).filter(Boolean))).sort();
    return [{ value: "all", label: "All Entities" }, ...values.map((value) => ({ value, label: value }))];
  }, [rows]);

  useEffect(() => {
    if (!canAccess) return;

    const run = async () => {
      setLoading(true);
      setError("");

      const result = await fetchAuditLogs({
        page,
        pageSize: 20,
        username: appliedUsername.trim() || undefined,
        action: appliedAction,
        entityType: appliedEntityType,
        startDate: appliedStartDate || undefined,
        endDate: appliedEndDate || undefined,
      });

      setLoading(false);

      if (!result.success) {
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setError(result.message || "Gagal memuat audit trail");
        return;
      }

      setRows(result.logs);
      setTotal(result.total);
      setTotalPages(Math.max(1, result.totalPages));
    };

    void run();
  }, [canAccess, page, appliedUsername, appliedAction, appliedEntityType, appliedStartDate, appliedEndDate]);

  const applyFilters = () => {
    setAppliedUsername(usernameFilter);
    setAppliedEntityType(entityTypeFilter);
    setAppliedAction(actionFilter);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setPage(1);
  };

  const resetFilters = () => {
    setUsernameFilter("");
    setEntityTypeFilter("all");
    setActionFilter("all");
    setStartDate("");
    setEndDate("");

    setAppliedUsername("");
    setAppliedEntityType("all");
    setAppliedAction("all");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setPage(1);
  };

  if (!canAccess) {
    return (
      <section className={baseStyles.panel}>
        <h1 className={baseStyles.title}>Akses Ditolak</h1>
        <p className={baseStyles.subtitle}>Halaman Audit Trail hanya untuk role SuperAdmin.</p>
      </section>
    );
  }

  return (
    <>
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Audit Trail</h1>
          <div className={baseStyles.subtitle}>Log aktivitas sistem untuk monitoring perubahan dan riwayat aksi.</div>
        </div>
      </div>

      <section className={baseStyles.panel}>
        <div className={baseStyles.panelHeader}>
          <h2 className={baseStyles.panelTitle}>Filter Audit Log</h2>
        </div>

        <div className={styles.filters}>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label} htmlFor="auditUsername">Username</label>
            <input
              id="auditUsername"
              className={baseStyles.input}
              placeholder="Cari username..."
              value={usernameFilter}
              onChange={(event) => setUsernameFilter(event.target.value)}
            />
          </div>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label}>Action</label>
            <Dropdown className={baseStyles.select} fullWidth options={ACTION_OPTIONS} value={actionFilter} onChange={setActionFilter} />
          </div>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label}>Entity</label>
            <Dropdown className={baseStyles.select} fullWidth options={entityTypeOptions} value={entityTypeFilter} onChange={setEntityTypeFilter} />
          </div>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label} htmlFor="auditStartDate">Tanggal Mulai</label>
            <input id="auditStartDate" type="date" className={baseStyles.input} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className={baseStyles.formGroup}>
            <label className={baseStyles.label} htmlFor="auditEndDate">Tanggal Akhir</label>
            <input id="auditEndDate" type="date" className={baseStyles.input} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        </div>

        <div className={styles.filterActions}>
          <button type="button" className={styles.btnSecondary} onClick={resetFilters}>Reset</button>
          <button type="button" className={styles.btnPrimary} onClick={applyFilters}>Apply Filter</button>
        </div>
      </section>

      <section className={baseStyles.panel}>
        <div className={styles.metaRow}>
          <span className={styles.metaText}>Total Log: {new Intl.NumberFormat("id-ID").format(total)}</span>
          <span className={styles.metaText}>Page {page} of {totalPages}</span>
        </div>

        {loading ? <p className={baseStyles.meta}>Memuat audit log...</p> : null}
        {error ? <p className={baseStyles.meta}>{error}</p> : null}

        <div className={baseStyles.tableWrap}>
          <table className={baseStyles.table}>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>IP Address</th>
                <th>User Agent</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>Belum ada data audit log</td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.LogId}>
                    <td>{formatDateTime(item.Timestamp)}</td>
                    <td>{item.Username || "-"}</td>
                    <td><span className={badgeClass(item.Action)}>{item.Action}</span></td>
                    <td>{item.EntityType || "-"}</td>
                    <td>{item.IPAddress || "-"}</td>
                    <td className={!item.UserAgent ? styles.mutedCell : undefined}>{item.UserAgent || "-"}</td>
                    <td>
                      <button type="button" className={styles.btnInline} onClick={() => setModal({ type: "detail", item })}>View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>Menampilkan {rows.length} dari {new Intl.NumberFormat("id-ID").format(total)} data</div>
          <div className={styles.paginationActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
              Prev
            </button>
            <button type="button" className={styles.btnSecondary} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        </div>
      </section>

      {modal.type === "detail" ? (
        <div className={styles.modalOverlay} onClick={() => setModal({ type: "none" })}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Detail Audit Log</h3>
              <button type="button" className={styles.modalClose} onClick={() => setModal({ type: "none" })}>x</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalGrid}>
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Log ID</p>
                  <p className={styles.detailValue}>{modal.item.LogId}</p>
                </div>
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Timestamp</p>
                  <p className={styles.detailValue}>{formatDateTime(modal.item.Timestamp)}</p>
                </div>
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Username</p>
                  <p className={styles.detailValue}>{modal.item.Username || "-"}</p>
                </div>
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Action</p>
                  <p className={styles.detailValue}>{modal.item.Action || "-"}</p>
                </div>
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Entity Type</p>
                  <p className={styles.detailValue}>{modal.item.EntityType || "-"}</p>
                </div>
                <div className={styles.detailItem}>
                  <p className={styles.detailLabel}>Entity ID</p>
                  <p className={styles.detailValue}>{modal.item.EntityId || "-"}</p>
                </div>
              </div>

              <div className={styles.jsonBlock}>
                <p className={styles.jsonTitle}>Old Values</p>
                <pre className={styles.jsonPre}>{formatJson(modal.item.OldValues)}</pre>
              </div>
              <div className={styles.jsonBlock}>
                <p className={styles.jsonTitle}>New Values</p>
                <pre className={styles.jsonPre}>{formatJson(modal.item.NewValues)}</pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
