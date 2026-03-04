"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Dropdown } from "@/components/common/dropdown";
import {
  createFunctionApplicationMapping,
  deleteFunctionApplicationMapping,
  exportFunctionApplicationMappingsCsv,
  fetchFunctionApplicationMappingsDetailed,
  type FunctionApplicationMappingItem,
} from "@/lib/mappings";
import { fetchApplicationsMaster, fetchFunctionsMaster, type ApplicationMaster, type FunctionMaster } from "@/lib/master-data";
import styles from "../mapping-pages.module.css";

type DeleteTarget =
  | { type: "row"; row: FunctionApplicationMappingItem }
  | { type: "app"; row: FunctionApplicationMappingItem; mappingId: string; appName: string };

export default function FunctionAplikasiPage() {
  const [rows, setRows] = useState<FunctionApplicationMappingItem[]>([]);
  const [functions, setFunctions] = useState<FunctionMaster[]>([]);
  const [applications, setApplications] = useState<ApplicationMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadFileName, setUploadFileName] = useState("");

  const [filterHead, setFilterHead] = useState("");
  const [filterFunction, setFilterFunction] = useState("");
  const [filterApplication, setFilterApplication] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [selectedFunctionId, setSelectedFunctionId] = useState("");
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);

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
    const headTerm = filterHead.trim().toLowerCase();
    const functionTerm = filterFunction.trim().toLowerCase();
    const appTerm = filterApplication.trim().toLowerCase();

    return rows.filter((row) => {
      const mappedHeadName = "-";
      if (headTerm && !mappedHeadName.toLowerCase().includes(headTerm)) return false;
      if (functionTerm && !row.functionName.toLowerCase().includes(functionTerm)) return false;
      if (appTerm && !row.applications.some((app) => app.applicationName.toLowerCase().includes(appTerm))) return false;
      return true;
    });
  }, [rows, filterHead, filterFunction, filterApplication]);

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
    setError("");
    await load();
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

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Mapping Function - Aplikasi</h1>
          <p className={styles.subtitle}>Atur subset aplikasi per function untuk event aktif.</p>
        </div>
        <div className={styles.toolbar}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={() => setShowModal(true)}>
            + Tambah Manual
          </button>
          <button className={styles.btn} type="button" onClick={() => void onExport()}>
            Export
          </button>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Upload Data Mapping</h2>
          <span className={styles.meta}>Upload file CSV/Excel untuk import data mapping.</span>
        </div>
        <div className={styles.formInline}>
          <div className={styles.formGroup} style={{ flex: 1 }}>
            <label className={styles.label}>Pilih file</label>
            <input
              className={`${styles.input} ${styles.fileInput}`}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => setUploadFileName(event.target.files?.[0]?.name || "")}
            />
          </div>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button">
            Upload
          </button>
        </div>
        <div className={styles.alert}>
          <strong>Format Upload:</strong> File CSV/Excel dengan kolom: IT Dept Head, Function, Application (satu app per row
          atau pisahkan dengan koma).
          {uploadFileName ? ` Dipilih: ${uploadFileName}` : ""}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Filter Data</h2>
          <div className={styles.meta}>Total: {filteredRows.length} records</div>
        </div>
        <div className={styles.filterGrid3}>
          <div className={styles.formGroup}>
            <label className={styles.label}>IT Dept Head</label>
            <input className={styles.input} value={filterHead} onChange={(event) => setFilterHead(event.target.value)} placeholder="Cari IT Dept Head" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Function</label>
            <input className={styles.input} value={filterFunction} onChange={(event) => setFilterFunction(event.target.value)} placeholder="Cari Function" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Application</label>
            <input className={styles.input} value={filterApplication} onChange={(event) => setFilterApplication(event.target.value)} placeholder="Cari Application" />
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Data Mapping Function - Aplikasi</h2>
        </div>
        <div className={styles.alert}>Kolom IT Dept Head sementara ditampilkan `-` karena data relasi belum tersedia dari endpoint backend.</div>
        {error ? <div className={styles.error}>{error}</div> : null}
        {loading ? <div className={styles.meta}>Memuat data...</div> : null}
        {!loading ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>IT Dept Head</th>
                  <th>Function</th>
                  <th>Applications</th>
                  <th>Actions</th>
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
                      <td>-</td>
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

      {showModal ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => !submitting && setShowModal(false)}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-label="Tambah Mapping Function Aplikasi" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Tambah Mapping</h2>
              <button className={styles.btn} type="button" onClick={() => !submitting && setShowModal(false)}>
                Close
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Function</label>
                <Dropdown
                  className={styles.input}
                  options={functions.map((item) => ({ value: item.FunctionId, label: item.Name }))}
                  value={selectedFunctionId}
                  onChange={setSelectedFunctionId}
                  placeholder="Pilih Function"
                  fullWidth
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Applications</label>
                <div className={styles.checkboxGrid}>
                  {applications.length === 0 ? <div className={styles.meta}>Tidak ada aplikasi aktif</div> : null}
                  {applications.map((app) => (
                    <label key={app.ApplicationId} className={styles.checkboxItem}>
                      <input type="checkbox" checked={selectedAppIds.includes(app.ApplicationId)} onChange={() => toggleAppSelection(app.ApplicationId)} />
                      <span>{app.Name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btn} type="button" onClick={() => !submitting && setShowModal(false)}>
                Cancel
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={() => void onSave()} disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
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
