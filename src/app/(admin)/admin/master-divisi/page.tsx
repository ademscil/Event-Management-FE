"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/admin/pagination";
import { SearchBar } from "@/components/admin/search-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Dropdown } from "@/components/common/dropdown";
import { FeedbackDialog } from "@/components/common/feedback-dialog";
import {
  createDivisionMaster,
  downloadDivisionTemplate,
  fetchBusinessUnitsMaster,
  fetchDivisionsMaster,
  updateDivisionMaster,
  uploadDivisionFile,
  type BusinessUnitMaster,
  type DivisionMaster,
} from "@/lib/master-data";
import styles from "../page-mockup.module.css";

const ITEMS_PER_PAGE = 10;
type FilterStatus = "all" | "active" | "inactive";

type DivisionRow = DivisionMaster & { businessUnitName: string };

function matchesSearch(item: DivisionRow, searchBy: string, keyword: string): boolean {
  const term = keyword.trim().toLowerCase();
  if (!term) return true;
  if (searchBy === "name") return item.Name.toLowerCase().includes(term);
  return item.Name.toLowerCase().includes(term);
}

export default function MasterDivisiPage() {
  const [rows, setRows] = useState<DivisionRow[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadFileName, setUploadFileName] = useState("No file chosen");
  const [uploadLoading, setUploadLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [buFilter, setBuFilter] = useState("all");
  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DivisionMaster | null>(null);
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState("Active");
  const [submitting, setSubmitting] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<DivisionRow | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [feedbackDialog, setFeedbackDialog] = useState({ open: false, title: "", message: "" });

  const [currentPage, setCurrentPage] = useState(1);

  const showFeedback = (message: string, title = "Informasi") => {
    setFeedbackDialog({ open: true, title, message });
  };

  const loadData = async () => {
    setLoading(true);
    const [divResult, buResult] = await Promise.all([fetchDivisionsMaster(), fetchBusinessUnitsMaster()]);

    if (!divResult.success) {
      setError(divResult.message);
      setRows([]);
      setLoading(false);
      return;
    }
    if (!buResult.success) {
      setError(buResult.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const buMap = new Map(buResult.data.map((item) => [item.BusinessUnitId, item.Name]));
    const mapped = divResult.data.map((item) => ({
      ...item,
      businessUnitName: buMap.get(item.BusinessUnitId) || "-",
    }));

    setRows(mapped);
    setBusinessUnits(buResult.data);
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
      if (buFilter !== "all" && item.BusinessUnitId !== buFilter) return false;
      return matchesSearch(item, appliedSearchBy, appliedKeyword);
    });
  }, [rows, statusFilter, buFilter, appliedSearchBy, appliedKeyword]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, buFilter, appliedSearchBy, appliedKeyword]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const openCreate = () => {
    setEditing(null);
    setBusinessUnitId("");
    setName("");
    setActive("Active");
    setShowModal(true);
  };

  const openEdit = (row: DivisionRow) => {
    setEditing(row);
    setBusinessUnitId(row.BusinessUnitId || "");
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
    if (!businessUnitId || !name.trim()) {
      showFeedback("BU dan Divisi Name wajib diisi.", "Validasi");
      return;
    }

    setSubmitting(true);
    if (!editing) {
      const result = await createDivisionMaster({
        businessUnitId,
        name: name.trim(),
      });
      setSubmitting(false);
      if (!result.success) {
        showFeedback(result.message, "Gagal Menyimpan");
        return;
      }
      closeModal();
      await loadData();
      return;
    }

    const result = await updateDivisionMaster(editing.DivisionId, {
      businessUnitId,
      name: name.trim(),
      isActive: active === "Active",
    });
    setSubmitting(false);

    if (!result.success) {
      showFeedback(result.message, "Gagal Menyimpan");
      return;
    }

    closeModal();
    await loadData();
  };

  const onToggleStatus = (row: DivisionRow) => setConfirmTarget(row);

  const onConfirmToggle = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    const result = await updateDivisionMaster(confirmTarget.DivisionId, {
      isActive: !confirmTarget.IsActive,
    });
    setConfirmLoading(false);

    if (!result.success) {
      showFeedback(result.message, "Gagal Mengubah Status");
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

  const onPickUploadFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    setUploadFileName(file?.name || "No file chosen");
  };

  const onDownloadTemplate = () => {
    void (async () => {
      const result = await downloadDivisionTemplate();
      if (!result.success || !result.blob) {
        showFeedback(result.message || "Gagal download template", "Gagal Download");
        return;
      }
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename || "master-divisi-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    })();
  };

  const onUploadMaster = () => {
    void (async () => {
      const fileInput = document.getElementById("master-divisi-file") as HTMLInputElement | null;
      const file = fileInput?.files?.[0];
      if (!file) {
        showFeedback("Pilih file Excel terlebih dahulu.", "Validasi");
        return;
      }
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
        showFeedback("Format file harus Excel (.xlsx atau .xls).", "Validasi");
        return;
      }
      setUploadLoading(true);
      const result = await uploadDivisionFile(file);
      setUploadLoading(false);
      if (!result.success) {
        showFeedback(result.message || "Gagal upload file", "Gagal Upload");
        return;
      }
      let message = `Upload berhasil! Imported: ${result.imported ?? 0}, Updated: ${result.updated ?? 0}, Gagal: ${result.failed ?? 0}`;
      if (result.errors && result.errors.length > 0) {
        message += "\n\nErrors:\n";
        result.errors.slice(0, 5).forEach((err) => {
          message += `Row ${err.row}: ${err.errors.join(", ")}\n`;
        });
        if (result.errors.length > 5) {
          message += `... dan ${result.errors.length - 5} error lainnya`;
        }
      }
      showFeedback(message, "Upload Selesai");
      setUploadFileName("No file chosen");
      if (fileInput) fileInput.value = "";
      await loadData();
    })();
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Master Divisi</h1>
          <div className={styles.subtitle}>Divisi reference data by BU.</div>
        </div>
        <div className={styles.toolbar}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={openCreate}>
            + Add Divisi
          </button>
        </div>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Filter</h2>
        <form onSubmit={onSearch}>
          <div className={styles.filterBarGrid}>
            <div className={styles.filterField}>
              <label id="mdiv-bu-label" className={styles.filterLabel} htmlFor="mdiv-bu-dropdown">BU</label>
              <Dropdown
                id="mdiv-bu-dropdown"
                className={styles.filterSelect}
                fullWidth
                options={[{ value: "all", label: "All BU" }, ...businessUnits.map((item) => ({ value: item.BusinessUnitId, label: item.Name }))]}
                value={buFilter}
                onChange={setBuFilter}
                aria-labelledby="mdiv-bu-label"
              />
            </div>
            <div className={styles.filterField}>
              <label id="mdiv-status-label" className={styles.filterLabel} htmlFor="mdiv-status-dropdown">Status</label>
              <Dropdown
                id="mdiv-status-dropdown"
                className={styles.filterSelect}
                fullWidth
                options={[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as FilterStatus)}
                aria-labelledby="mdiv-status-label"
              />
            </div>
          </div>
          <SearchBar
            options={[
              { value: "all", label: "Search By" },
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
          <h2 className={styles.panelTitle}>Daftar Divisi</h2>
          <div className={styles.meta}>Total {filteredRows.length} divisi</div>
        </div>

        {error ? <div className={styles.meta}>{error}</div> : null}
        {loading ? <div className={styles.meta}>Memuat data...</div> : null}

        {!loading && !error ? (
          <>
            <div className={`${styles.tableWrap} ${styles.masterTableWrap}`}>
              <table className={`${styles.table} ${styles.masterTable}`}>
                <thead>
                  <tr>
                    <th scope="col">No.</th>
                    <th scope="col">BU</th>
                    <th scope="col">Divisi Name</th>
                    <th scope="col">Status</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Tidak ada data divisi</td>
                    </tr>
                  ) : (
                    paginatedRows.map((item, index) => (
                      <tr key={item.DivisionId}>
                        <td>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                        <td>{item.businessUnitName}</td>
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

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Upload Data Master</h2>
          <span className={styles.meta}>Unggah data master divisi dari file Excel.</span>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="master-divisi-file">Pilih file</label>
          <div className={styles.uploadRow}>
            <div className={styles.filePickerWrap}>
              <input
                id="master-divisi-file"
                className={styles.fileInputHidden}
                type="file"
                accept=".xlsx,.xls"
                onChange={onPickUploadFile}
              />
              <label className={styles.fileTrigger} htmlFor="master-divisi-file">
                Choose File
              </label>
              <span className={styles.fileText}>{uploadFileName}</span>
            </div>
            <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={onDownloadTemplate}>
              Download Template
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={onUploadMaster} disabled={uploadLoading}>
              {uploadLoading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
        <div className={styles.uploadNote}>
          Format file: Excel (.xlsx/.xls). Kolom: BU Name, Divisi Name, Status. Download template untuk format yang benar.
        </div>
      </section>

      {showModal ? (
        <div className={styles.modalOverlay} role="presentation" onClick={closeModal}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="master-divisi-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 id="master-divisi-modal-title" className={styles.modalTitle}>{editing ? "Edit Divisi" : "Add Divisi"}</h2>
              <button className={styles.modalClose} type="button" onClick={closeModal} aria-label="Tutup modal">x</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label id="mdiv-modal-bu-label" className={styles.label} htmlFor="mdiv-modal-bu-dropdown">BU</label>
                <Dropdown
                  id="mdiv-modal-bu-dropdown"
                  className={styles.select}
                  options={[{ value: "", label: "Pilih BU" }, ...businessUnits.map((item) => ({ value: item.BusinessUnitId, label: item.Name }))]}
                  value={businessUnitId}
                  onChange={setBusinessUnitId}
                  aria-labelledby="mdiv-modal-bu-label"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="master-divisi-name-input">Divisi Name</label>
                <input id="master-divisi-name-input" name="divisiName" className={styles.input} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. IT Digital" />
              </div>
              <div className={styles.formGroup}>
                <label id="mdiv-modal-status-label" className={styles.label} htmlFor="mdiv-modal-status-dropdown">Status</label>
                <Dropdown
                  id="mdiv-modal-status-dropdown"
                  className={styles.select}
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Inactive", label: "Inactive" },
                  ]}
                  value={active}
                  onChange={setActive}
                  aria-labelledby="mdiv-modal-status-label"
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
        title={`${confirmTarget?.IsActive ? "Deactivate" : "Activate"} Divisi`}
        message={`Yakin ingin ${confirmTarget?.IsActive ? "deactivate" : "activate"} ${confirmTarget?.Name || "item"}?`}
        confirmLabel={confirmTarget?.IsActive ? "Deactivate" : "Activate"}
        variant={confirmTarget?.IsActive ? "danger" : "primary"}
        isLoading={confirmLoading}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={onConfirmToggle}
      />

      <FeedbackDialog
        open={feedbackDialog.open}
        title={feedbackDialog.title}
        message={feedbackDialog.message}
        onClose={() => setFeedbackDialog({ open: false, title: "", message: "" })}
      />
    </>
  );
}





