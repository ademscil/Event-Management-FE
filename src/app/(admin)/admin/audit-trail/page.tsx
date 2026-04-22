"use client";

import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import { getCurrentUser } from "@/lib/auth";
import { fetchAuditLogs, type AuditLogItem } from "@/lib/audit";
import type { UserRole } from "@/types/auth";
import { useEffect, useMemo, useState } from "react";
import baseStyles from "../page-mockup.module.css";
import styles from "./audit-trail.module.css";

const ACTION_OPTIONS = [
  { value: "all", label: "Semua Action" },
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

const SEARCH_BY_OPTIONS = [
  { value: "all", label: "Search By" },
  { value: "username", label: "Username" },
  { value: "entityId", label: "Entity ID" },
  { value: "ipAddress", label: "IP Address" },
  { value: "userAgent", label: "User Agent" },
];

type ModalState = { type: "none" } | { type: "detail"; item: AuditLogItem };

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(d);
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function badgeClass(action: string): string {
  const map: Record<string, string> = {
    Create: styles.badgeCreate,
    Update: styles.badgeUpdate,
    Delete: styles.badgeDelete,
    Login: styles.badgeLogin,
    Logout: styles.badgeLogout,
    LoginFailed: styles.badgeLoginFailed,
    Approve: styles.badgeApprove,
    Reject: styles.badgeReject,
    Export: styles.badgeExport,
    Access: styles.badgeAccess,
  };
  return `${styles.badge} ${map[action] ?? styles.badgeDefault}`;
}

function dotClass(action: string): string {
  const map: Record<string, string> = {
    Create: styles.dotCreate,
    Update: styles.dotUpdate,
    Delete: styles.dotDelete,
    Login: styles.dotLogin,
    Logout: styles.dotLogout,
    LoginFailed: styles.dotLoginFailed,
    Approve: styles.dotApprove,
    Reject: styles.dotReject,
    Export: styles.dotExport,
    Access: styles.dotAccess,
  };
  return `${styles.dot} ${map[action] ?? styles.dotDefault}`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
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

  // Filter state (draft)
  const [keywordFilter, setKeywordFilter] = useState("");
  const [searchBy, setSearchBy] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Applied filter state
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedEntityType, setAppliedEntityType] = useState("all");
  const [appliedAction, setAppliedAction] = useState("all");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  const entityTypeOptions = useMemo(() => {
    const values = Array.from(
      new Set(rows.map((item) => String(item.EntityType || "").trim()).filter(Boolean))
    ).sort();
    return [
      { value: "all", label: "Semua Entity" },
      ...values.map((v) => ({ value: v, label: v })),
    ];
  }, [rows]);

  // Stats derived from current page rows
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.Action] = (counts[row.Action] ?? 0) + 1;
    }
    return {
      total,
      failed: counts["LoginFailed"] ?? 0,
      logins: counts["Login"] ?? 0,
      mutations: (counts["Create"] ?? 0) + (counts["Update"] ?? 0) + (counts["Delete"] ?? 0),
    };
  }, [rows, total]);

  useEffect(() => {
    if (!canAccess) return;
    let active = true;

    const run = async () => {
      setLoading(true);
      setError("");

      const result = await fetchAuditLogs({
        page,
        pageSize: 20,
        keyword: appliedKeyword.trim() || undefined,
        searchBy: appliedSearchBy as "all" | "username" | "entityId" | "ipAddress" | "userAgent",
        action: appliedAction,
        entityType: appliedEntityType,
        startDate: appliedStartDate || undefined,
        endDate: appliedEndDate || undefined,
      });

      if (!active) return;
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
    return () => { active = false; };
  }, [canAccess, page, appliedKeyword, appliedSearchBy, appliedAction, appliedEntityType, appliedStartDate, appliedEndDate]);

  const applyFilters = () => {
    setAppliedKeyword(keywordFilter);
    setAppliedSearchBy(searchBy);
    setAppliedEntityType(entityTypeFilter);
    setAppliedAction(actionFilter);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchBy("all"); setKeywordFilter("");
    setEntityTypeFilter("all"); setActionFilter("all");
    setStartDate(""); setEndDate("");
    setAppliedKeyword(""); setAppliedSearchBy("all");
    setAppliedEntityType("all"); setAppliedAction("all");
    setAppliedStartDate(""); setAppliedEndDate("");
    setPage(1);
  };

  // Pagination page numbers (max 5 visible)
  const pageNumbers = useMemo(() => {
    const range: number[] = [];
    const delta = 2;
    const left = Math.max(1, page - delta);
    const right = Math.min(totalPages, page + delta);
    for (let i = left; i <= right; i++) range.push(i);
    return range;
  }, [page, totalPages]);

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
      {/* Page Header */}
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Audit Trail</h1>
          <p className={baseStyles.subtitle}>Riwayat aktivitas sistem — monitoring perubahan data dan aksi pengguna secara real-time.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Log</span>
          <span className={styles.statValue}>{fmtNum(stats.total)}</span>
          <span className={styles.statSub}>semua aktivitas tercatat</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Login Berhasil</span>
          <span className={styles.statValue}>{fmtNum(stats.logins)}</span>
          <span className={styles.statSub}>pada halaman ini</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Login Gagal</span>
          <span className={styles.statValue} style={{ color: stats.failed > 0 ? "#c2410c" : undefined }}>
            {fmtNum(stats.failed)}
          </span>
          <span className={styles.statSub}>percobaan gagal</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Mutasi Data</span>
          <span className={styles.statValue}>{fmtNum(stats.mutations)}</span>
          <span className={styles.statSub}>create / update / delete</span>
        </div>
      </div>

      {/* Filter Panel */}
      <div className={styles.filterPanel}>
        <div className={styles.filterPanelHead}>
          <h2 className={styles.filterPanelTitle}>Filter</h2>
        </div>

        <SearchBar
          options={SEARCH_BY_OPTIONS}
          selectedValue={searchBy}
          keyword={keywordFilter}
          onSelectedValueChange={setSearchBy}
          onKeywordChange={setKeywordFilter}
          onButtonClick={applyFilters}
          placeholder={
            searchBy === "username" ? "Cari username..."
            : searchBy === "entityId" ? "Cari entity ID..."
            : searchBy === "ipAddress" ? "Cari IP Address..."
            : searchBy === "userAgent" ? "Cari user agent..."
            : "Pilih Search By"
          }
        />

        <div className={styles.filterGrid} style={{ marginTop: 14 }}>
          <div>
            <label id="audit-action-label" className={styles.filterLabel} htmlFor="audit-action-dropdown">Action</label>
            <Dropdown
              id="audit-action-dropdown"
              className={styles.filterSelect}
              fullWidth
              options={ACTION_OPTIONS}
              value={actionFilter}
              onChange={setActionFilter}
              aria-labelledby="audit-action-label"
            />
          </div>
          <div>
            <label id="audit-entity-label" className={styles.filterLabel} htmlFor="audit-entity-dropdown">Entity Type</label>
            <Dropdown
              id="audit-entity-dropdown"
              className={styles.filterSelect}
              fullWidth
              options={entityTypeOptions}
              value={entityTypeFilter}
              onChange={setEntityTypeFilter}
              aria-labelledby="audit-entity-label"
            />
          </div>
          <div>
            <label className={styles.filterLabel} htmlFor="auditStart">Tanggal Mulai</label>
            <input
              id="auditStart"
              type="date"
              className={styles.filterInput}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className={styles.filterLabel} htmlFor="auditEnd">Tanggal Akhir</label>
            <input
              id="auditEnd"
              type="date"
              className={styles.filterInput}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.filterActions}>
          <button type="button" className={styles.btnReset} onClick={resetFilters}>Reset</button>
          <button type="button" className={styles.btnApply} onClick={applyFilters}>Terapkan Filter</button>
        </div>
      </div>

      {/* Table Panel */}
      <div className={styles.tablePanel}>
        <div className={styles.tablePanelHead}>
          <h2 className={styles.tablePanelTitle}>Log Aktivitas</h2>
          <span className={styles.tableMeta}>
            {loading ? "Memuat..." : `${fmtNum(total)} entri ditemukan`}
          </span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Waktu</th>
                <th scope="col">Pengguna</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">IP Address</th>
                <th scope="col">User Agent</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={styles.loadingRow}>
                  <td colSpan={7}>Memuat data audit log...</td>
                </tr>
              ) : error ? (
                <tr className={styles.errorRow}>
                  <td colSpan={7}>{error}</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>🔍</div>
                      <div className={styles.emptyText}>Tidak ada data audit log</div>
                      <div className={styles.emptySubtext}>Coba ubah filter atau rentang tanggal</div>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.LogId}>
                    <td className={styles.cellTime}>
                      <div>{formatDate(item.Timestamp)}</div>
                      <div className={styles.cellTimeSub}>{formatTime(item.Timestamp)}</div>
                    </td>
                    <td>
                      <div className={styles.rowIndicator}>
                        <span className={dotClass(item.Action)} aria-hidden="true" />
                        <span className={styles.cellUser}>{item.Username || "-"}</span>
                      </div>
                    </td>
                    <td>
                      <span className={badgeClass(item.Action)}>{item.Action}</span>
                    </td>
                    <td>
                      <div className={styles.cellEntity}>{item.EntityType || "-"}</div>
                      {item.EntityId ? (
                        <div className={styles.cellEntitySub} title={item.EntityId}>
                          {item.EntityId.slice(0, 8)}…
                        </div>
                      ) : null}
                    </td>
                    <td className={styles.cellIp}>{item.IPAddress || "-"}</td>
                    <td>
                      <div className={styles.cellUa} title={item.UserAgent ?? undefined}>
                        {item.UserAgent || "-"}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnView}
                        aria-label={`Lihat detail log ${item.Action} oleh ${item.Username || "-"}`}
                        onClick={() => setModal({ type: "detail", item })}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Menampilkan {rows.length} dari {fmtNum(total)} entri &nbsp;·&nbsp; Halaman {page} / {totalPages}
          </span>
          <div className={styles.paginationControls}>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setPage(1)}
              disabled={page <= 1}
              aria-label="Halaman pertama"
            >
              «
            </button>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Halaman sebelumnya"
            >
              ‹
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.pageBtn} ${n === page ? styles.pageBtnActive : ""}`}
                onClick={() => setPage(n)}
                aria-current={n === page ? "page" : undefined}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Halaman berikutnya"
            >
              ›
            </button>
            <button
              type="button"
              className={styles.pageBtn}
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              aria-label="Halaman terakhir"
            >
              »
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {modal.type === "detail" ? (
        <div
          className={styles.modalOverlay}
          onClick={() => setModal({ type: "none" })}
          role="presentation"
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auditModalTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <span className={`${badgeClass(modal.item.Action)} ${styles.modalActionBadge}`}>
                  {modal.item.Action}
                </span>
                <div>
                  <h3 id="auditModalTitle" className={styles.modalTitle}>
                    Detail Audit Log
                  </h3>
                  <p className={styles.modalSubtitle}>{formatDateTime(modal.item.Timestamp)}</p>
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                aria-label="Tutup modal"
                onClick={() => setModal({ type: "none" })}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Identity */}
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Identitas Log</p>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>Log ID</p>
                    <p className={`${styles.detailValue} ${styles.detailValueMono}`}>{modal.item.LogId}</p>
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
                </div>
              </div>

              {/* Entity */}
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Entitas Terdampak</p>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>Entity Type</p>
                    <p className={styles.detailValue}>{modal.item.EntityType || "-"}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>Entity ID</p>
                    <p className={`${styles.detailValue} ${styles.detailValueMono}`}>{modal.item.EntityId || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Network */}
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Informasi Jaringan</p>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>IP Address</p>
                    <p className={`${styles.detailValue} ${styles.detailValueMono}`}>{modal.item.IPAddress || "-"}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>User Agent</p>
                    <p className={styles.detailValue} style={{ fontSize: 11, wordBreak: "break-all" }}>
                      {modal.item.UserAgent || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payload */}
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Payload Perubahan</p>

                <div className={styles.jsonSection}>
                  <div className={styles.jsonHeader}>
                    <span className={styles.jsonLabel}>
                      <span className={`${styles.jsonLabelDot} ${styles.jsonLabelDotOld}`} />
                      Old Values
                    </span>
                  </div>
                  {modal.item.OldValues ? (
                    <pre className={styles.jsonPre}>{formatJson(modal.item.OldValues)}</pre>
                  ) : (
                    <div className={styles.jsonEmpty}>Tidak ada data sebelumnya</div>
                  )}
                </div>

                <div className={styles.jsonSection}>
                  <div className={styles.jsonHeader}>
                    <span className={styles.jsonLabel}>
                      <span className={`${styles.jsonLabelDot} ${styles.jsonLabelDotNew}`} />
                      New Values
                    </span>
                  </div>
                  {modal.item.NewValues ? (
                    <pre className={styles.jsonPre}>{formatJson(modal.item.NewValues)}</pre>
                  ) : (
                    <div className={styles.jsonEmpty}>Tidak ada data baru</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
