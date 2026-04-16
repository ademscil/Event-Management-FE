"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { createUser, downloadUserList, downloadUserTemplateFile, fetchUsersWithFilters, setUserPassword, toggleUserLdap, updateUser, uploadUserFile } from "@/lib/users";
import {
  fetchOrgHierarchy,
  type BusinessUnitOption,
  type DepartmentOption,
  type DivisionOption,
} from "@/lib/org-hierarchy";
import type { UserListItem } from "@/types/user";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/admin/pagination";
import { SearchBar } from "@/components/admin/search-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Dropdown } from "@/components/common/dropdown";
import { FeedbackDialog } from "@/components/common/feedback-dialog";
import styles from "../page-mockup.module.css";
import MasterUserFormModal from "./master-user-form-modal";
import { matchesUserSearch, roleLabel } from "./master-user-utils";

const ITEMS_PER_PAGE = 10;

type UploadUserError = { row: number; errors: string[] };

export default function MasterUserPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFileName, setSelectedFileName] = useState("No file chosen");
  const [loading, setLoading] = useState(true);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [newUsername, setNewUsername] = useState("");
  const [newNpk, setNewNpk] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newRole, setNewRole] = useState<"SuperAdmin" | "AdminEvent" | "ITLead" | "DepartmentHead">("AdminEvent");
  const [newUseLdap, setNewUseLdap] = useState(true);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [newBusinessUnitId, setNewBusinessUnitId] = useState("");
  const [newDivisionId, setNewDivisionId] = useState("");
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newStatus, setNewStatus] = useState("Active");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmTargetUser, setConfirmTargetUser] = useState<UserListItem | null>(null);
  const [confirmNextIsActive, setConfirmNextIsActive] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [feedbackDialog, setFeedbackDialog] = useState({ open: false, title: "", message: "" });

  const showFeedback = (message: string, title = "Informasi") => {
    setFeedbackDialog({ open: true, title, message });
  };

  const filteredDivisions = divisions.filter(
    (division) => !newBusinessUnitId || division.BusinessUnitId === newBusinessUnitId
  );
  const filteredDepartments = departments.filter(
    (department) => !newDivisionId || department.DivisionId === newDivisionId
  );

  const filterDepartments = useMemo(() => {
    const seen = new Set<string>();
    const unique: DepartmentOption[] = [];
    for (const department of departments) {
      const key = (department.Name || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(department);
    }
    return unique;
  }, [departments]);

  const loadUsers = useCallback(async (searchText = appliedKeyword) => {
    setLoading(true);
    const result = await fetchUsersWithFilters({
      search: searchText,
      role: roleFilter,
      isActive: statusFilter === "all" ? undefined : statusFilter === "active" ? "true" : "false",
      includeInactive: statusFilter === "all" ? "true" : undefined,
      departmentId: departmentFilter,
    });
    if (!result.success) {
      setError(result.message || "Gagal memuat data user");
      setUsers([]);
      setLoading(false);
      return;
    }

    setUsers(result.users);
    setError("");
    setLoading(false);
  }, [appliedKeyword, roleFilter, statusFilter, departmentFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void (async () => {
      const result = await fetchOrgHierarchy();
      if (!result.success) {
        setError(result.message || "Gagal memuat data organisasi");
        return;
      }

      setBusinessUnits(result.businessUnits);
      setDivisions(result.divisions);
      setDepartments(result.departments);
    })();
  }, []);

  const onSearch: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setAppliedSearchBy(searchBy);
    setAppliedKeyword(keyword);
    void loadUsers(keyword);
  };

  useEffect(() => {
    if (!newBusinessUnitId) return;
    const firstDivision = divisions.find((item) => item.BusinessUnitId === newBusinessUnitId);
    if (!firstDivision) {
      setNewDivisionId("");
      setNewDepartmentId("");
      return;
    }

    if (!filteredDivisions.some((item) => item.DivisionId === newDivisionId)) {
      setNewDivisionId(firstDivision.DivisionId);
    }
  }, [divisions, filteredDivisions, newBusinessUnitId, newDivisionId]);

  useEffect(() => {
    if (!newDivisionId) return;
    const firstDepartment = departments.find((item) => item.DivisionId === newDivisionId);
    if (!firstDepartment) {
      setNewDepartmentId("");
      return;
    }

    if (!filteredDepartments.some((item) => item.DepartmentId === newDepartmentId)) {
      setNewDepartmentId(firstDepartment.DepartmentId);
    }
  }, [departments, filteredDepartments, newDivisionId, newDepartmentId]);

  const onUpload = async () => {
    const fileInput = document.getElementById("master-user-file") as HTMLInputElement | null;
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

    const result = await uploadUserFile(file);
    if (!result.success) {
      showFeedback(result.message || "Gagal upload file", "Gagal Upload");
      return;
    }

    let message = `Upload berhasil! Imported: ${result.imported || 0}, Failed: ${result.failed || 0}`;
    if (result.errors && result.errors.length > 0) {
      message += "\n\nErrors:\n";
      result.errors.slice(0, 5).forEach((err: UploadUserError) => {
        message += `Row ${err.row}: ${err.errors.join(", ")}\n`;
      });
      if (result.errors.length > 5) {
        message += `... dan ${result.errors.length - 5} error lainnya`;
      }
    }
    showFeedback(message, "Upload Berhasil");
    setSelectedFileName("No file chosen");
    if (fileInput) fileInput.value = "";
    await loadUsers(appliedKeyword);
  };

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    setSelectedFileName(file?.name || "No file chosen");
  };

  const onDownloadTemplate = () => {
    void (async () => {
      const result = await downloadUserTemplateFile();
      if (!result.success || !result.blob) {
        showFeedback(result.message || "Gagal download template", "Gagal Download");
        return;
      }

      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename || "master-user-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    })();
  };

  const onDownload = async () => {
    const result = await downloadUserList();
    if (!result.success || !result.blob) {
      showFeedback(result.message || "Gagal download user list", "Gagal Download");
      return;
    }

    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename || "user-list.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const displayedUsers = useMemo(() => {
    return users.filter((user) => matchesUserSearch(user, appliedSearchBy, appliedKeyword));
  }, [users, appliedSearchBy, appliedKeyword]);

  const totalPages = Math.max(1, Math.ceil(displayedUsers.length / ITEMS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayedUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, displayedUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedKeyword, appliedSearchBy, roleFilter, departmentFilter, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetUserForm = () => {
    setEditingUser(null);
    setShowCreateModal(false);
    setNewUsername("");
    setNewNpk("");
    setNewDisplayName("");
    setNewEmail("");
    setNewPhoneNumber("");
    setNewRole("AdminEvent");
    setNewUseLdap(true);
    setNewBusinessUnitId("");
    setNewDivisionId("");
    setNewDepartmentId("");
    setNewStatus("Active");
    setNewPassword("");
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setShowCreateModal(true);
    setNewUsername("");
    setNewNpk("");
    setNewDisplayName("");
    setNewEmail("");
    setNewPhoneNumber("");
    setNewRole("AdminEvent");
    setNewUseLdap(true);
    setNewBusinessUnitId("");
    setNewDivisionId("");
    setNewDepartmentId("");
    setNewStatus("Active");
    setNewPassword("");
  };

  const openEditModal = (user: UserListItem) => {
    setEditingUser(user);
    setShowCreateModal(true);
    setNewUsername(user.Username || "");
    setNewNpk(user.NPK || "");
    setNewDisplayName(user.DisplayName || "");
    setNewEmail(user.Email || "");
    setNewPhoneNumber(user.PhoneNumber || "");
    setNewRole((user.Role as typeof newRole) || "AdminEvent");
    setNewUseLdap(Boolean(user.UseLDAP));
    setNewBusinessUnitId(user.BusinessUnitId || "");
    setNewDivisionId(user.DivisionId || "");
    setNewDepartmentId(user.DepartmentId || "");
    setNewStatus(user.IsActive ? "Active" : "Inactive");
    setNewPassword("");
  };

  const onToggleUserStatus = (user: UserListItem) => {
    setConfirmTargetUser(user);
    setConfirmNextIsActive(!user.IsActive);
  };

  const closeStatusConfirm = () => {
    if (confirmSubmitting) return;
    setConfirmTargetUser(null);
  };

  const onConfirmToggleStatus = async () => {
    if (!confirmTargetUser) return;

    setConfirmSubmitting(true);
    const result = await updateUser(confirmTargetUser.UserId, { isActive: confirmNextIsActive });
    setConfirmSubmitting(false);

    if (!result.success) {
      showFeedback(result.message || "Gagal mengubah status user", "Gagal Mengubah Status");
      return;
    }

    setConfirmTargetUser(null);
    await loadUsers(appliedKeyword);
  };

  const onSubmitUser = async () => {
    if (!newUsername.trim() || !newNpk.trim() || !newDisplayName.trim() || !newEmail.trim()) {
      showFeedback("Username, NPK, Name, dan Email wajib diisi.", "Validasi");
      return;
    }
    if (!newBusinessUnitId || !newDivisionId || !newDepartmentId) {
      showFeedback("Business Unit, Divisi, dan Department wajib dipilih.", "Validasi");
      return;
    }
    if (!newUseLdap && !editingUser && newPassword.trim().length < 8) {
      showFeedback("Password minimal 8 karakter untuk user non-LDAP.", "Validasi");
      return;
    }

    setSubmittingUser(true);

    if (!editingUser) {
      const createResult = await createUser({
        username: newUsername.trim(),
        npk: newNpk.trim(),
        displayName: newDisplayName.trim(),
        email: newEmail.trim(),
        phoneNumber: newPhoneNumber.trim() || undefined,
        role: newRole,
        useLDAP: newUseLdap,
        businessUnitId: newBusinessUnitId,
        divisionId: newDivisionId,
        departmentId: newDepartmentId,
        password: newUseLdap ? undefined : newPassword.trim(),
      });
      setSubmittingUser(false);

      if (!createResult.success) {
        showFeedback(createResult.message || "Gagal membuat user", "Gagal Menyimpan");
        return;
      }

      resetUserForm();
      await loadUsers(appliedKeyword);
      return;
    }

    const updateResult = await updateUser(editingUser.UserId, {
      username: newUsername.trim(),
      npk: newNpk.trim(),
      displayName: newDisplayName.trim(),
      email: newEmail.trim(),
      phoneNumber: newPhoneNumber.trim() || undefined,
      role: newRole,
      businessUnitId: newBusinessUnitId,
      divisionId: newDivisionId,
      departmentId: newDepartmentId,
      isActive: newStatus === "Active",
    });

    if (!updateResult.success) {
      setSubmittingUser(false);
      showFeedback(updateResult.message || "Gagal memperbarui user", "Gagal Menyimpan");
      return;
    }

    if (newUseLdap !== editingUser.UseLDAP) {
      const ldapResult = await toggleUserLdap(editingUser.UserId, newUseLdap);
      if (!ldapResult.success) {
        setSubmittingUser(false);
        showFeedback(ldapResult.message || "Gagal memperbarui LDAP user", "Gagal Menyimpan");
        return;
      }
    }

    if (!newUseLdap && newPassword.trim()) {
      const passwordResult = await setUserPassword(editingUser.UserId, newPassword.trim());
      if (!passwordResult.success) {
        setSubmittingUser(false);
        showFeedback(passwordResult.message || "Gagal memperbarui password user", "Gagal Menyimpan");
        return;
      }
    }

    setSubmittingUser(false);
    resetUserForm();
    await loadUsers(appliedKeyword);
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Master User</h1>
          <div className={styles.subtitle}>User access, role, and approval mapping.</div>
        </div>
        <div className={styles.toolbar}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={openCreateModal}
            type="button"
          >
            + Create User
          </button>
        </div>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Filter</h2>
        <form onSubmit={onSearch}>
          <div className={styles.periodRow}>
            <div className={styles.periodLabel}>ROLE</div>
            <div className={styles.periodColon}>:</div>
            <Dropdown
              className={`${styles.select} ${styles.statusControl}`}
              options={[
                { value: "all", label: "All Roles" },
                { value: "SuperAdmin", label: "Super Admin" },
                { value: "AdminEvent", label: "Admin Event" },
                { value: "ITLead", label: "IT Lead" },
                { value: "DepartmentHead", label: "Dept Head" },
              ]}
              value={roleFilter}
              onChange={setRoleFilter}
            />
          </div>
          <div className={styles.periodRow}>
            <div className={styles.periodLabel}>DEPARTMENT</div>
            <div className={styles.periodColon}>:</div>
            <Dropdown
              className={`${styles.select} ${styles.statusControl}`}
              options={[
                { value: "all", label: "All Departments" },
                ...filterDepartments.map((department) => ({
                  value: department.DepartmentId,
                  label: department.Name,
                })),
              ]}
              value={departmentFilter}
              onChange={setDepartmentFilter}
            />
          </div>
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
              onChange={setStatusFilter}
            />
          </div>
          <SearchBar
            rowClassName={styles.masterSearchRow}
            selectClassName={styles.masterSearchSelect}
            inputClassName={`${styles.input} ${styles.masterSearchInput}`}
            buttonClassName={styles.masterSearchButton}
            options={[
              { value: "all", label: "Search By" },
              { value: "npk", label: "NPK" },
              { value: "username", label: "Username" },
              { value: "name", label: "Name" },
              { value: "email", label: "Email" },
              { value: "role", label: "Role" },
            ]}
            selectedValue={searchBy}
            keyword={keyword}
            onSelectedValueChange={setSearchBy}
            onKeywordChange={setKeyword}
            buttonType="submit"
            trailingContent={(
              <button className={styles.masterDownloadButton} type="button" onClick={onDownload}>
                Download
              </button>
            )}
          />
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Daftar User</h2>
          <div className={styles.meta}>Total {displayedUsers.length} users</div>
        </div>

        {error ? <div className={styles.meta}>{error}</div> : null}
        {loading ? <div className={styles.meta}>Memuat data user...</div> : null}

        {!loading && !error ? (
          <>
          <div className={`${styles.tableWrap} ${styles.masterTableWrap}`}>
            <table className={`${styles.table} ${styles.masterTable}`}>
              <thead>
                <tr>
                  <th>NPK</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Divisi</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={9}>Tidak ada data user</td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.UserId}>
                      <td>{user.NPK || "-"}</td>
                      <td>{user.DisplayName}</td>
                      <td>{user.Email}</td>
                      <td>{user.PhoneNumber || "-"}</td>
                      <td>{roleLabel(user.Role)}</td>
                      <td>{user.DivisionName || "-"}</td>
                      <td>{user.DepartmentName || "-"}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${user.IsActive ? styles.badgeActive : styles.badgeClosed}`}
                        >
                          {user.IsActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className={styles.btnRow}>
                          <button
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            type="button"
                            onClick={() => openEditModal(user)}
                          >
                            Edit
                          </button>
                          <button
                            className={`${styles.btn} ${user.IsActive ? styles.btnDanger : styles.btnPrimary}`}
                            type="button"
                            onClick={() => onToggleUserStatus(user)}
                          >
                            {user.IsActive ? "Deactivate" : "Activate"}
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
            totalItems={displayedUsers.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
          </>
        ) : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Upload Data Master</h2>
          <span className={styles.meta}>Unggah user admin/IT lead dari file Excel.</span>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Pilih file</label>
          <div className={styles.uploadRow}>
            <div className={styles.filePickerWrap}>
              <input
                id="master-user-file"
                className={styles.fileInputHidden}
                type="file"
                accept=".xlsx,.xls"
                onChange={onPickFile}
              />
              <label className={styles.fileTrigger} htmlFor="master-user-file">
                Choose File
              </label>
              <span className={styles.fileText}>{selectedFileName}</span>
            </div>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onDownloadTemplate} type="button">
              Download Template
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onUpload} type="button">
              Upload
            </button>
          </div>
        </div>
        <div className={styles.uploadNote}>
          Format file: Excel (.xlsx/.xls). Kolom minimal: Username, NPK, Nama, Email, Role, Status.
          Opsional: UseLDAP, Password (wajib bila UseLDAP=false).
        </div>
      </section>

      <MasterUserFormModal
        businessUnits={businessUnits}
        editingUser={editingUser}
        filteredDepartments={filteredDepartments}
        filteredDivisions={filteredDivisions}
        newBusinessUnitId={newBusinessUnitId}
        newDepartmentId={newDepartmentId}
        newDisplayName={newDisplayName}
        newDivisionId={newDivisionId}
        newEmail={newEmail}
        newNpk={newNpk}
        newPassword={newPassword}
        newPhoneNumber={newPhoneNumber}
        newRole={newRole}
        newStatus={newStatus}
        newUseLdap={newUseLdap}
        newUsername={newUsername}
        onClose={resetUserForm}
        onSubmit={onSubmitUser}
        setNewBusinessUnitId={setNewBusinessUnitId}
        setNewDepartmentId={setNewDepartmentId}
        setNewDisplayName={setNewDisplayName}
        setNewDivisionId={setNewDivisionId}
        setNewEmail={setNewEmail}
        setNewNpk={setNewNpk}
        setNewPassword={setNewPassword}
        setNewPhoneNumber={setNewPhoneNumber}
        setNewRole={setNewRole}
        setNewStatus={setNewStatus}
        setNewUseLdap={setNewUseLdap}
        setNewUsername={setNewUsername}
        showCreateModal={showCreateModal}
        submittingUser={submittingUser}
      />
      <ConfirmDialog
        open={Boolean(confirmTargetUser)}
        title={confirmNextIsActive ? "Activate User" : "Deactivate User"}
        message={
          confirmTargetUser
            ? (confirmNextIsActive
                ? `Aktifkan user ${confirmTargetUser.DisplayName}?`
                : `Nonaktifkan user ${confirmTargetUser.DisplayName}?`)
            : ""
        }
        confirmLabel={confirmNextIsActive ? "Activate" : "Deactivate"}
        variant={confirmNextIsActive ? "primary" : "danger"}
        isLoading={confirmSubmitting}
        onConfirm={() => {
          void onConfirmToggleStatus();
        }}
        onCancel={closeStatusConfirm}
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