"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import {
  createDepartmentApplicationMapping,
  deleteDepartmentApplicationMapping,
  exportDepartmentApplicationMappingsCsv,
  fetchDepartmentApplicationMappingsHierarchical,
  type DepartmentApplicationMappingHierarchy,
} from "@/lib/mappings";
import {
  fetchApplicationsMaster,
  fetchBusinessUnitsMaster,
  fetchDepartmentsMaster,
  fetchDivisionsMaster,
  type ApplicationMaster,
  type BusinessUnitMaster,
  type DepartmentMaster,
  type DivisionMaster,
} from "@/lib/master-data";
import styles from "../mapping-pages.module.css";
import baseStyles from "../page-mockup.module.css";

type RowItem = {
  key: string;
  businessUnitId: string;
  businessUnitName: string;
  divisionId: string;
  divisionName: string;
  departmentId: string;
  departmentName: string;
  applications: Array<{
    mappingId: string;
    applicationId: string;
    applicationName: string;
  }>;
};

type DeleteTarget =
  | { type: "row"; row: RowItem }
  | { type: "app"; row: RowItem; mappingId: string; appName: string };

type EditTarget = {
  row: RowItem;
};

function flattenRows(data: DepartmentApplicationMappingHierarchy[]): RowItem[] {
  const rows: RowItem[] = [];
  data.forEach((bu) => {
    bu.divisions.forEach((div) => {
      div.departments.forEach((dept) => {
        rows.push({
          key: dept.departmentId,
          businessUnitId: bu.businessUnitId,
          businessUnitName: bu.businessUnitName,
          divisionId: div.divisionId,
          divisionName: div.divisionName,
          departmentId: dept.departmentId,
          departmentName: dept.departmentName,
          applications: (dept.applications || []).map((app) => ({
            mappingId: app.mappingId,
            applicationId: app.applicationId,
            applicationName: app.applicationName,
          })),
        });
      });
    });
  });
  return rows;
}

export default function DeptAplikasiPage() {
  const [rows, setRows] = useState<RowItem[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitMaster[]>([]);
  const [divisions, setDivisions] = useState<DivisionMaster[]>([]);
  const [departments, setDepartments] = useState<DepartmentMaster[]>([]);
  const [applications, setApplications] = useState<ApplicationMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploadFileName, setUploadFileName] = useState("No file chosen");
  const [uploadInfo, setUploadInfo] = useState("");

  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [selectedBu, setSelectedBu] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [mappingRes, buRes, divRes, deptRes, appRes] = await Promise.all([
      fetchDepartmentApplicationMappingsHierarchical(),
      fetchBusinessUnitsMaster(),
      fetchDivisionsMaster(),
      fetchDepartmentsMaster(),
      fetchApplicationsMaster(),
    ]);

    if (!mappingRes.success) {
      setError(mappingRes.message || "Gagal memuat mapping dept-aplikasi");
      setRows([]);
    } else {
      setRows(flattenRows(mappingRes.mappings));
      setError("");
    }

    setBusinessUnits(buRes.success ? buRes.data.filter((item) => item.IsActive) : []);
    setDivisions(divRes.success ? divRes.data.filter((item) => item.IsActive) : []);
    setDepartments(deptRes.success ? deptRes.data.filter((item) => item.IsActive) : []);
    setApplications(appRes.success ? appRes.data.filter((item) => item.IsActive) : []);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);

      const [mappingRes, buRes, divRes, deptRes, appRes] = await Promise.all([
        fetchDepartmentApplicationMappingsHierarchical(),
        fetchBusinessUnitsMaster(),
        fetchDivisionsMaster(),
        fetchDepartmentsMaster(),
        fetchApplicationsMaster(),
      ]);

      if (!active) return;

      if (!mappingRes.success) {
        setError(mappingRes.message || "Gagal memuat mapping dept-aplikasi");
        setRows([]);
      } else {
        setRows(flattenRows(mappingRes.mappings));
        setError("");
      }

      setBusinessUnits(buRes.success ? buRes.data.filter((item) => item.IsActive) : []);
      setDivisions(divRes.success ? divRes.data.filter((item) => item.IsActive) : []);
      setDepartments(deptRes.success ? deptRes.data.filter((item) => item.IsActive) : []);
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
      if (!term) return true;

      if (appliedSearchBy === "businessUnit") {
        return row.businessUnitName.toLowerCase().includes(term);
      }
      if (appliedSearchBy === "division") {
        return row.divisionName.toLowerCase().includes(term);
      }
      if (appliedSearchBy === "department") {
        return row.departmentName.toLowerCase().includes(term);
      }
      if (appliedSearchBy === "application") {
        return row.applications.some((app) => app.applicationName.toLowerCase().includes(term));
      }

      const haystacks = [
        row.businessUnitName,
        row.divisionName,
        row.departmentName,
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

  const divisionOptions = useMemo(
    () =>
      divisions
        .filter((item) => !selectedBu || item.BusinessUnitId === selectedBu)
        .map((item) => ({ value: item.DivisionId, label: item.Name })),
    [divisions, selectedBu],
  );

  const departmentOptions = useMemo(
    () =>
      departments
        .filter((item) => !selectedDivision || item.DivisionId === selectedDivision)
        .map((item) => ({ value: item.DepartmentId, label: item.Name })),
    [departments, selectedDivision],
  );

  const resetForm = () => {
    setSelectedBu("");
    setSelectedDivision("");
    setSelectedDepartment("");
    setSelectedAppIds([]);
    setEditTarget(null);
  };

  const onOpenAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const onOpenEdit = (row: RowItem) => {
    setEditTarget({ row });
    setSelectedBu(row.businessUnitId);
    setSelectedDivision(row.divisionId);
    setSelectedDepartment(row.departmentId);
    setSelectedAppIds(row.applications.map((item) => item.applicationId));
    setError("");
    setShowModal(true);
  };

  const onSave = async () => {
    if (!selectedDepartment || selectedAppIds.length === 0) {
      setError("Department dan minimal 1 aplikasi wajib dipilih.");
      return;
    }
    setSubmitting(true);
    if (!editTarget) {
      const result = await createDepartmentApplicationMapping({
        departmentId: selectedDepartment,
        applicationIds: selectedAppIds,
      });
      setSubmitting(false);
      if (!result.success) {
        setError(result.message || "Gagal menyimpan mapping");
        return;
      }
      setShowModal(false);
      resetForm();
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
      const removeResult = await deleteDepartmentApplicationMapping(mappingId);
      if (!removeResult.success) {
        setSubmitting(false);
        setError(removeResult.message || "Gagal memperbarui mapping");
        return;
      }
    }

    if (addAppIds.length > 0) {
      const addResult = await createDepartmentApplicationMapping({
        departmentId: selectedDepartment,
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
    resetForm();
    setError("");
    await load();
  };

  const toggleAppSelection = (applicationId: string) => {
    setSelectedAppIds((prev) =>
      prev.includes(applicationId) ? prev.filter((id) => id !== applicationId) : [...prev, applicationId],
    );
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    if (deleteTarget.type === "app") {
      const result = await deleteDepartmentApplicationMapping(deleteTarget.mappingId);
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
      const result = await deleteDepartmentApplicationMapping(app.mappingId);
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
    const result = await exportDepartmentApplicationMappingsCsv();
    if (!result.success || !result.blob) {
      setError(result.message || "Gagal export mapping");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mapping-dept-aplikasi.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const onPickUploadFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    setUploadFileName(file?.name || "No file chosen");
    setUploadInfo("");
  };

  const onDownloadTemplate = () => {
    setUploadInfo("Template upload Mapping Department - Aplikasi belum tersedia.");
  };

  const onUploadMapping = () => {
    if (uploadFileName === "No file chosen") {
      setUploadInfo("Pilih file terlebih dahulu.");
      return;
    }
    setUploadInfo("Upload bulk Mapping Department - Aplikasi belum tersedia.");
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Mapping Department - Aplikasi</h1>
          <p className={styles.subtitle}>Pastikan setiap department memiliki subset aplikasi yang relevan.</p>
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
            <label className={baseStyles.filterLabel}>Status</label>
            <Dropdown
              className={baseStyles.filterSelect}
              fullWidth
              options={[{ value: "all", label: "All" }]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
        </div>
        <SearchBar
          options={[
            { value: "all", label: "Search By" },
            { value: "businessUnit", label: "Business Unit" },
            { value: "division", label: "Division" },
            { value: "department", label: "Department" },
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
          <h2 className={styles.panelTitle}>Data Mapping Department - Aplikasi</h2>
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
        {loading ? <div className={styles.meta}>Memuat data...</div> : null}
        {!loading ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Business Unit</th>
                  <th>Division</th>
                  <th>Department</th>
                  <th>Applications</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.empty}>
                      Tidak ada mapping department-aplikasi
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => (
                    <tr key={row.key}>
                      <td>{index + 1}</td>
                      <td>{row.businessUnitName}</td>
                      <td>{row.divisionName}</td>
                      <td>{row.departmentName}</td>
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
          <span className={styles.meta}>Upload file CSV/Excel untuk import data mapping.</span>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Pilih file</label>
          <div className={styles.uploadRow}>
            <div className={styles.filePickerWrap}>
              <input
                id="dept-aplikasi-file"
                className={styles.fileInputHidden}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={onPickUploadFile}
              />
              <label className={styles.fileTrigger} htmlFor="dept-aplikasi-file">
                Choose File
              </label>
              <span className={styles.fileText}>{uploadFileName}</span>
            </div>
            <button className={`${styles.btn} ${styles.btnSecondary}`} type="button" onClick={onDownloadTemplate}>
              Download Template
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={onUploadMapping}>
              Upload
            </button>
          </div>
        </div>
        <div className={styles.uploadNote}>
          Format upload: CSV/Excel dengan kolom Business Unit, Division, Department, Application.
        </div>
        {uploadInfo ? <div className={styles.meta}>{uploadInfo}</div> : null}
      </section>

      {showModal ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={() => {
            if (submitting) return;
            setShowModal(false);
            resetForm();
          }}
        >
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-label={editTarget ? "Edit Mapping Department Aplikasi" : "Tambah Mapping Department Aplikasi"} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editTarget ? "Edit Mapping" : "Tambah Mapping"}</h2>
              <button
                className={styles.modalClose}
                type="button"
                aria-label="Close"
                onClick={() => {
                  if (submitting) return;
                  setShowModal(false);
                  resetForm();
                }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Business Unit</label>
                <Dropdown
                  className={styles.input}
                  options={businessUnits.map((item) => ({ value: item.BusinessUnitId, label: item.Name }))}
                  value={selectedBu}
                  onChange={(value) => {
                    setSelectedBu(value);
                    setSelectedDivision("");
                    setSelectedDepartment("");
                  }}
                  placeholder="Pilih Business Unit"
                  disabled={Boolean(editTarget)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Division</label>
                <Dropdown
                  className={styles.input}
                  options={divisionOptions}
                  value={selectedDivision}
                  onChange={(value) => {
                    setSelectedDivision(value);
                    setSelectedDepartment("");
                  }}
                  placeholder="Pilih Division"
                  disabled={Boolean(editTarget)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Department</label>
                <Dropdown
                  className={styles.input}
                  options={departmentOptions}
                  value={selectedDepartment}
                  onChange={setSelectedDepartment}
                  placeholder="Pilih Department"
                  disabled={Boolean(editTarget)}
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
              <button
                className={styles.btn}
                type="button"
                onClick={() => {
                  if (submitting) return;
                  setShowModal(false);
                  resetForm();
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
            ? `Hapus aplikasi ${deleteTarget.appName} dari mapping ${deleteTarget.row.departmentName}?`
            : "Hapus semua mapping aplikasi pada department ini?"
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
