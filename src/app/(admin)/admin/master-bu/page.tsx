"use client";

import { useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/admin/pagination";
import { SearchBar } from "@/components/admin/search-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Dropdown } from "@/components/common/dropdown";
import {
  createBusinessUnitMaster,
  fetchBusinessUnitsMaster,
  updateBusinessUnitMaster,
  type BusinessUnitMaster,
} from "@/lib/master-data";
import styles from "../page-mockup.module.css";

const ITEMS_PER_PAGE = 10;

type FilterStatus = "all" | "active" | "inactive";

function matchesSearch(item: BusinessUnitMaster, searchBy: string, keyword: string): boolean {
  const term = keyword.trim().toLowerCase();
  if (!term) return true;
  if (searchBy === "code") return (item.Code || "").toLowerCase().includes(term);
  if (searchBy === "name") return (item.Name || "").toLowerCase().includes(term);
  return (item.Code || "").toLowerCase().includes(term) || (item.Name || "").toLowerCase().includes(term);
}

export default function MasterBUPage() {
  const [rows, setRows] = useState<BusinessUnitMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BusinessUnitMaster | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState("Active");
  const [submitting, setSubmitting] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<BusinessUnitMaster | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    const result = await fetchBusinessUnitsMaster();
    if (!result.success) {
      setError(result.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(result.data);
    setError("");
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      if (statusFilter === "active" && !item.IsActive) return false;
      if (statusFilter === "inactive" && item.IsActive) return false;
      return matchesSearch(item, appliedSearchBy, appliedKeyword);
    });
  }, [rows, statusFilter, appliedSearchBy, appliedKeyword]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, appliedSearchBy, appliedKeyword]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setName("");
    setActive("Active");
    setShowModal(true);
  };

  const openEdit = (row: BusinessUnitMaster) => {
    setEditing(row);
    setCode(row.Code || "");
    setName(row.Name || "");
    setActive(row.IsActive ? "Active" : "Inactive");
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setEditing(null);
  };

  const onSubmit = async () => {
    if (!code.trim() || !name.trim()) {
      window.alert("BU Code dan BU Name wajib diisi.");
      return;
    }

    setSubmitting(true);
    if (!editing) {
      const result = await createBusinessUnitMaster({ code: code.trim(), name: name.trim() });
      setSubmitting(false);
      if (!result.success) {
        window.alert(result.message);
        return;
      }
      closeModal();
      await loadData();
      return;
    }

    const result = await updateBusinessUnitMaster(editing.BusinessUnitId, {
      code: code.trim(),
      name: name.trim(),
      isActive: active === "Active",
    });
    setSubmitting(false);

    if (!result.success) {
      window.alert(result.message);
      return;
    }

    closeModal();
    await loadData();
  };

  const onToggleStatus = (row: BusinessUnitMaster) => {
    setConfirmTarget(row);
  };

  const onConfirmToggle = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    const result = await updateBusinessUnitMaster(confirmTarget.BusinessUnitId, {
      isActive: !confirmTarget.IsActive,
    });
    setConfirmLoading(false);

    if (!result.success) {
      window.alert(result.message);
      return;
    }

    setConfirmTarget(null);
    await loadData();
  };

  const onSearch: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setAppliedSearchBy(searchBy);
    setAppliedKeyword(keyword);
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Master BU</h1>
          <div className={styles.subtitle}>Manage business unit reference data.</div>
        </div>
        <div className={styles.toolbar}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={openCreate}>
            + Add BU
          </button>
        </div>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Filter</h2>
        <form onSubmit={onSearch}>
          <div className={styles.periodRow}>
            <div className={styles.periodLabel}>STATUS</div>
            <div className={styles.periodColon}>:</div>
            <Dropdown
              className={`${styles.select} ${styles.statusControl}`}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as FilterStatus)}
            />
          </div>
          <SearchBar
            rowClassName={styles.masterSearchRow}
            selectClassName={styles.masterSearchSelect}
            inputClassName={`${styles.input} ${styles.masterSearchInput}`}
            buttonClassName={styles.masterSearchButton}
            options={[
              { value: "all", label: "Search By" },
              { value: "code", label: "Code" },
              { value: "name", label: "Name" },
            ]}
            selectedValue={searchBy}
            keyword={keyword}
            onSelectedValueChange={setSearchBy}
            onKeywordChange={setKeyword}
            buttonType="submit"
          />
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Daftar Business Unit</h2>
          <div className={styles.meta}>Total {filteredRows.length} BU</div>
        </div>

        {error ? <div className={styles.meta}>{error}</div> : null}
        {loading ? <div className={styles.meta}>Memuat data...</div> : null}

        {!loading && !error ? (
          <>
            <div className={`${styles.tableWrap} ${styles.masterTableWrap}`}>
              <table className={`${styles.table} ${styles.masterTable}`}>
                <thead>
                  <tr>
                    <th>BU Code</th>
                    <th>BU Name</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Tidak ada data business unit</td>
                    </tr>
                  ) : (
                    paginatedRows.map((item) => (
                      <tr key={item.BusinessUnitId}>
                        <td>{item.Code}</td>
                        <td>{item.Name}</td>
                        <td>
                          <span className={`${styles.badge} ${item.IsActive ? styles.badgeActive : styles.badgeClosed}`}>
                            {item.IsActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className={styles.btnRow}>
                            <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={() => openEdit(item)}>
                              Edit
                            </button>
                            <button
                              className={`${styles.btn} ${item.IsActive ? styles.btnDanger : styles.btnPrimary}`}
                              type="button"
                              onClick={() => onToggleStatus(item)}
                            >
                              {item.IsActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              className={styles.pagination}
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredRows.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </>
        ) : null}
      </section>

      {showModal ? (
        <div className={styles.modalOverlay} role="presentation" onClick={closeModal}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-label={editing ? "Edit BU" : "Add BU"} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editing ? "Edit BU" : "Add BU"}</h2>
              <button className={styles.modalClose} type="button" onClick={closeModal}>x</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>BU Code</label>
                <input className={styles.input} value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. HO" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>BU Name</label>
                <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Corporate HO" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Status</label>
                <Dropdown
                  className={styles.select}
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Inactive", label: "Inactive" },
                  ]}
                  value={active}
                  onChange={setActive}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={closeModal}>Cancel</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={onSubmit} disabled={submitting}>
                {submitting ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={`${confirmTarget?.IsActive ? "Deactivate" : "Activate"} Business Unit`}
        message={`Yakin ingin ${confirmTarget?.IsActive ? "deactivate" : "activate"} ${confirmTarget?.Name || "item"}?`}
        confirmLabel={confirmTarget?.IsActive ? "Deactivate" : "Activate"}
        variant={confirmTarget?.IsActive ? "danger" : "primary"}
        isLoading={confirmLoading}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={onConfirmToggle}
      />
    </>
  );
}
