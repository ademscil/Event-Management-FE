"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import {
  createFunctionApplicationMapping,
  deleteFunctionApplicationMapping,
  exportFunctionApplicationMappingsCsv,
  fetchFunctionApplicationMappingsDetailed,
  downloadMappingTemplate,
  bulkImportMappings,
  type BulkImportResult,
  type FunctionApplicationMappingItem,
} from "@/lib/mappings";
import { fetchApplicationsMaster, fetchFunctionsMaster, type ApplicationMaster, type FunctionMaster } from "@/lib/master-data";
import styles from "../mapping-pages.module.css";
import baseStyles from "../page-mockup.module.css";

type DeleteTarget =
  | { type: "row"; row: FunctionApplicationMappingItem }
  | { type: "app"; row: FunctionApplicationMappingItem; mappingId: string; appName: string };

type EditTarget = {
  row: FunctionApplicationMappingItem;
};

export default function FunctionAplikasiPage() {
  const [rows, setRows] = useState<FunctionApplicationMappingItem[]>([]);
  const [functions, setFunctions] = useState<FunctionMaster[]>([]);
  const [applications, setApplications] = useState<ApplicationMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadFileName, setUploadFileName] = useState("No file chosen");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadInfo, setUploadInfo] = useState("");
  const [uploadErrors, setUploadErrors] = useState<BulkImportResult["errors"]>([]);
  const [uploading, setUploading] = useState(false);

  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [selectedFunctionId, setSelectedFunctionId] = useState("");
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [mappingRes, functionRes, appRes] = await Promise.all([
      fetchFunctionApplicationMappingsDetailed(),
      fetchFunctionsMaster(),
      fetchApplicationsMaster(),
    ]);

    if (!mappingRes.success) {
      setError(mappingRes.message || "Gagal memuat mapping function-aplikasi");
      setRows([]);
    } else {
      setRows(mappingRes.mappings);
      setError("");
    }

    setFunctions(functionRes.success ? functionRes.data.filter((item) => item.IsActive) : []);
    setApplications(appRes.success ? appRes.data.filter((item) => item.IsActive) : []);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);

      const [mappingRes, functionRes, appRes] = await Promise.all([
        fetchFunctionApplicationMappingsDetailed(),
        fetchFunctionsMaster(),
        fetchApplicationsMaster(),
      ]);

      if (!active) return;

      if (!mappingRes.success) {
        setError(mappingRes.message || "Gagal memuat mapping function-aplikasi");
        setRows([]);
      } else {
        setRows(mappingRes.mappings);
        setError("");
      }

      setFunctions(functionRes.success ? functionRes.data.filter((item) => item.IsActive) : []);
      setApplications(appRes.success ? appRes.data.filter((item) => item.IsActive) : []);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const term = appliedKeyword.trim().toLowerCase();

    return rows.filter((row) => {
      const itLeadName = row.itLeadName || "";
      if (!term) return true;

      if (appliedSearchBy === "head") {
        return itLeadName.toLowerCase().includes(term);
      }
      if (appliedSearchBy === "function") {
        return row.functionName.toLowerCase().includes(term);
      }
      if (appliedSearchBy === "application") {
        return row.applications.some((app) => app.applicationName.toLowerCase().includes(term));
      }

      const haystacks = [
        itLeadName,
        row.functionName,
        ...row.applications.map((app) => app.applicationName),
      ];
      if (!haystacks.some((value) => String(value || "").toLowerCase().includes(term))) return false;
      return true;
    });
  }, [rows, appliedKeyword, appliedSearchBy]);

  const onApplySearch = () => {
    setAppliedSearchBy(searchBy);
    setAppliedKeyword(keyword);
  };

  const toggleAppSelection = (applicationId: string) => {
    setSelectedAppIds((prev) =>
      prev.includes(applicationId) ? prev.filter((id) => id !== applicationId) : [...prev, applicationId],
    );
  };

  const onSave = async () => {
    if (!selectedFunctionId || selectedAppIds.length === 0) {
      setError("Function dan minimal 1 aplikasi wajib dipilih.");
      return;
    }
    setSubmitting(true);
    if (!editTarget) {
      const result = await createFunctionApplicationMapping({
        functionId: selectedFunctionId,
        applicationIds: selectedAppIds,
      });
      setSubmitting(false);
      if (!result.success) {
        setError(result.message || "Gagal menyimpan mapping");
        return;
      }
      setShowModal(false);
      setSelectedFunctionId("");
      setSelectedAppIds([]);
      setEditTarget(null);
      setError("");
      await load();
      return;
    }

    const currentIds = new Set(editTarget.row.applications.map((item) => item.applicationId));
    const nextIds = new Set(selectedAppIds);
    const removeMappings = editTarget.row.applications
      .filter((item) => !nextIds.has(item.applicationId))
      .map((item) => item.mappingId);
    const addAppIds = selectedAppIds.filter((id) => !currentIds.has(id));

    for (const mappingId of removeMappings) {
      const removeResult = await deleteFunctionApplicationMapping(mappingId);
      if (!removeResult.success) {
        setSubmitting(false);
        setError(removeResult.message || "Gagal memperbarui mapping");
        return;
      }
    }

    if (addAppIds.length > 0) {
      const addResult = await createFunctionApplicationMapping({
        functionId: selectedFunctionId,
        applicationIds: addAppIds,
      });
      if (!addResult.success) {
        setSubmitting(false);
        setError(addResult.message || "Gagal memperbarui mapping");
        return;
      }
    }

    setSubmitting(false);
    setShowModal(false);
    setSelectedFunctionId("");
    setSelectedAppIds([]);
    setEditTarget(null);
    setError("");
    await load();
  };

  const onOpenAdd = () => {
    setSelectedFunctionId("");
    setSelectedAppIds([]);
    setEditTarget(null);
    setError("");
    setShowModal(true);
  };

  const onOpenEdit = (row: FunctionApplicationMappingItem) => {
    setEditTarget({ row });
    setSelectedFunctionId(row.functionId);
    setSelectedAppIds(row.applications.map((item) => item.applicationId));
    setError("");
    setShowModal(true);
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    if (deleteTarget.type === "app") {
      const result = await deleteFunctionApplicationMapping(deleteTarget.mappingId);
      setDeleteLoading(false);
      if (!result.success) {
        setError(result.message || "Gagal menghapus aplikasi");
        return;
      }
      setDeleteTarget(null);
      setError("");
      await load();
      return;
    }

    for (const app of deleteTarget.row.applications) {
      const result = await deleteFunctionApplicationMapping(app.mappingId);
      if (!result.success) {
        setDeleteLoading(false);
        setError(result.message || "Gagal menghapus mapping");
        return;
      }
    }
    setDeleteLoading(false);
    setDeleteTarget(null);
    setError("");
    await load();
  };

  const onExport = async () => {
    const result = await exportFunctionApplicationMappingsCsv();
    if (!result.success || !result.blob) {
      setError(result.message || "Gagal export mapping");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mapping-function-aplikasi.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const onPickUploadFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] ?? null;
    setUploadFileName(file?.name || "No file chosen");
    setUploadFile(file);
    setUploadInfo("");
    setUploadErrors([]);
  };

  const onDownloadTemplate = async () => {
    const result = await downloadMappingTemplate("function-application");
    if (!result.success || !result.blob) {
      setUploadInfo("Gagal mengunduh template. Coba lagi.");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-mapping-function-aplikasi.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const onUploadMapping = async () => {
    if (!uploadFile) {
      setUploadInfo("Pilih file terlebih dahulu.");
      return;
    }
    setUploading(true);
    setUploadInfo("");
    setUploadErrors([]);

    const result = await bulkImportMappings(uploadFile, "function-application");
    setUploading(false);

    if (!result.success) {
      setUploadInfo(result.message || "Upload gagal.");
      setUploadErrors(result.errors ?? []);
      return;
    }

    const summary = `Berhasil diimpor: ${result.imported ?? 0} baris. Dilewati: ${result.skipped ?? 0}. Gagal: ${result.failed ?? 0}.`;
    setUploadInfo(summary);
    setUploadErrors(result.errors ?? []);
    setUploadFileName("No file chosen");
    setUploadFile(null);
    // Reset file input
    const input = document.getElementById("function-aplikasi-file") as HTMLInputElement | null;
    if (input) input.value = "";
    await load();
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Mapping Function - Aplikasi</h1>
          <p className={styles.subtitle}>Atur subset aplikasi per function untuk event aktif.</p>
        </div>
        <div className={styles.toolbar}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={onOpenAdd}>
            Tambah Manual
          </button>
          <button className={styles.btn} type="button" onClick={() => void onExport()}>
            Export
          </button>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Filter Data</h2>
          <div className={styles.meta}>Total: {filteredRows.length} records</div>
        </div>
        <div className={baseStyles.filterBarGrid}>
          <div className={baseStyles.filterField}>
            <label id="func-app-filter-label-status" className={baseStyles.filterLabel} htmlFor="func-app-status-filter">Status</label>
            <Dropdown
              id="func-app-status-filter"
              className={baseStyles.filterSelect}
              fullWidth
              options={[{ value: "all", label: "All" }]}
              value={statusFilter}
              onChange={setStatusFilter}
              aria-labelledby="func-app-filter-label-status"
            />
          </div>
        </div>
        <SearchBar
          options={[
            { value: "all", label: "Search By" },
            { value: "head", label: "IT Lead" },
            { value: "function", label: "Function" },
            { value: "application", label: "Application" },
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
          <h2 className={styles.panelTitle}>Data Mapping Function - Aplikasi</h2>
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
        {loading ? <div className={styles.meta}>Memuat data...</div> : null}
        {!loading ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">No</th>
                  <th scope="col">IT Lead</th>
                  <th scope="col">Function</th>
                  <th scope="col">Applications</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      Tidak ada mapping function-aplikasi
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr key={row.functionId}>
                      <td>{index + 1}</td>
                      <td>{row.itLeadName || "-"}</td>
                      <td>{row.functionName}</td>
                      <td>
                        <div className={styles.tags}>
                          {row.applications.map((app) => (
                            <span key={app.mappingId} className={styles.tag}>
                              {app.applicationName}
                              <button
                                className={styles.tagRemove}
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: "app",
                                    row,
                                    mappingId: app.mappingId,
                                    appName: app.applicationName,
                                  })
                                }
                              >
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className={styles.btnRow}>
                          <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnXs}`} type="button" onClick={() => onOpenEdit(row)}>
                            Edit
                          </button>
                          <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnXs}`} type="button" onClick={() => setDeleteTarget({ type: "row", row })}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Upload Data Mapping</h2>
          <span className={styles.meta}>Upload file Excel (.xlsx) untuk import data mapping secara massal.</span>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="function-aplikasi-file">Pilih file Excel</label>
          <div className={styles.uploadRow}>
            <div className={styles.filePickerWrap}>
              <input
                id="function-aplikasi-file"
                className={styles.fileInputHidden}
                type="file"
                accept=".xlsx,.xls"
                onChange={onPickUploadFile}
                aria-describedby="function-aplikasi-upload-note"
              />
              <label className={styles.fileTrigger} htmlFor="function-aplikasi-file">
                Pilih File
              </label>
              <span className={styles.fileText}>{uploadFileName}</span>
            </div>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              type="button"
              onClick={() => void onDownloadTemplate()}
            >
              Download Template
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              type="button"
              onClick={() => void onUploadMapping()}
              disabled={uploading || !uploadFile}
              aria-busy={uploading}
            >
              {uploading ? "Mengupload..." : "Upload"}
            </button>
          </div>
        </div>
        <p id="function-aplikasi-upload-note" className={styles.uploadNote}>
          Format: Excel (.xlsx) dengan kolom <strong>Function Code</strong> dan <strong>Application Code</strong>.
          Download template untuk contoh format yang benar.
        </p>
        {uploadInfo ? (
          <div
            className={uploadErrors && uploadErrors.length > 0 ? styles.error : styles.meta}
            role="status"
            aria-live="polite"
          >
            {uploadInfo}
          </div>
        ) : null}
        {uploadErrors && uploadErrors.length > 0 ? (
          <details className={styles.uploadErrorDetails}>
            <summary className={styles.uploadErrorSummary}>
              Lihat detail error ({uploadErrors.length} baris)
            </summary>
            <ul className={styles.uploadErrorList}>
              {uploadErrors.map((err, i) => (
                <li key={i}>
                  <strong>Baris {err.row}:</strong> {err.errors.join(", ")}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {showModal ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={() => {
            if (submitting) return;
            setShowModal(false);
            setSelectedFunctionId("");
            setSelectedAppIds([]);
            setEditTarget(null);
          }}
        >
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="func-app-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 id="func-app-modal-title" className={styles.modalTitle}>{editTarget ? "Edit Mapping" : "Tambah Mapping"}</h2>
              <button
                className={styles.modalClose}
                type="button"
                aria-label="Close"
                onClick={() => {
                  if (submitting) return;
                  setShowModal(false);
                  setSelectedFunctionId("");
                  setSelectedAppIds([]);
                  setEditTarget(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label id="func-app-modal-label-function" className={styles.label} htmlFor="func-app-modal-function">Function</label>
                <Dropdown
                  id="func-app-modal-function"
                  className={styles.input}
                  options={functions.map((item) => ({ value: item.FunctionId, label: item.Name }))}
                  value={selectedFunctionId}
                  onChange={setSelectedFunctionId}
                  placeholder="Pilih Function"
                  disabled={Boolean(editTarget)}
                  aria-labelledby="func-app-modal-label-function"
                />
              </div>
              <div className={styles.formGroup}>
                <span id="func-app-modal-label-apps" className={styles.label}>Applications</span>
                <div className={styles.checkboxGrid} role="group" aria-labelledby="func-app-modal-label-apps">
                  {applications.length === 0 ? <div className={styles.meta}>Tidak ada aplikasi aktif</div> : null}
                  {applications.map((app) => (
                    <label key={app.ApplicationId} className={styles.checkboxItem}>
                      <input
                        id={`functionAppSelect-${app.ApplicationId}`}
                        name="selectedAppIds"
                        type="checkbox"
                        value={String(app.ApplicationId)}
                        checked={selectedAppIds.includes(app.ApplicationId)}
                        onChange={() => toggleAppSelection(app.ApplicationId)}
                      />
                      <span>{app.Name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.btn}
                type="button"
                onClick={() => {
                  if (submitting) return;
                  setShowModal(false);
                  setSelectedFunctionId("");
                  setSelectedAppIds([]);
                  setEditTarget(null);
                }}
              >
                Cancel
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={() => void onSave()} disabled={submitting}>
                {submitting ? "Saving..." : editTarget ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Mapping"
        message={
          deleteTarget?.type === "app"
            ? `Hapus aplikasi ${deleteTarget.appName} dari mapping ${deleteTarget.row.functionName}?`
            : "Hapus semua mapping aplikasi pada function ini?"
        }
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        isLoading={deleteLoading}
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
      />
    </>
  );
}
