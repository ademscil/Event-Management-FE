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
import styles from "../page-mockup.module.css";

const ITEMS_PER_PAGE = 10;

type UploadUserError = { row: number; errors: string[] };

function roleLabel(role: string): string {
  switch (role) {
    case "SuperAdmin":
      return "Super Admin";
    case "AdminEvent":
      return "Admin Event";
    case "ITLead":
      return "IT Lead";
    case "DepartmentHead":
      return "Dept Head";
    default:
      return role;
  }
}

function matchesUserSearch(user: UserListItem, searchBy: string, keyword: string): boolean {
  const term = keyword.trim().toLowerCase();
  if (!term) return true;

  if (searchBy === "npk") return (user.NPK || user.Username || "").toLowerCase().includes(term);
  if (searchBy === "username") return user.Username.toLowerCase().includes(term);
  if (searchBy === "name") return user.DisplayName.toLowerCase().includes(term);
  if (searchBy === "email") return user.Email.toLowerCase().includes(term);
  if (searchBy === "role") return roleLabel(user.Role).toLowerCase().includes(term);

  return (
    (user.NPK || user.Username || "").toLowerCase().includes(term) ||
    user.Username.toLowerCase().includes(term) ||
    user.DisplayName.toLowerCase().includes(term) ||
    user.Email.toLowerCase().includes(term) ||
    roleLabel(user.Role).toLowerCase().includes(term)
  );
}

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
      window.alert("Pilih file Excel terlebih dahulu.");
      return;
    }
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      window.alert("Format file harus Excel (.xlsx atau .xls).");
      return;
    }

    const result = await uploadUserFile(file);
    if (!result.success) {
      window.alert(result.message || "Gagal upload file");
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
    window.alert(message);
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
        window.alert(result.message || "Gagal download template");
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
      window.alert(result.message || "Gagal download user list");
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
      window.alert(result.message || "Gagal mengubah status user");
      return;
    }

    setConfirmTargetUser(null);
    await loadUsers(appliedKeyword);
  };

  const onSubmitUser = async () => {
    if (!newUsername.trim() || !newNpk.trim() || !newDisplayName.trim() || !newEmail.trim()) {
      window.alert("Username, NPK, Name, dan Email wajib diisi.");
      return;
    }
    if (!newBusinessUnitId || !newDivisionId || !newDepartmentId) {
      window.alert("Business Unit, Divisi, dan Department wajib dipilih.");
      return;
    }
    if (!newUseLdap && !editingUser && newPassword.trim().length < 8) {
      window.alert("Password minimal 8 karakter untuk user non-LDAP.");
      return;
    }

    setSubmittingUser(true);

    if (!editingUser) {
      const createResult = await createUser({
        username: newUsername.trim(),
        npk: newNpk.trim(),
        displayName: newDisplayName.trim(),
        email: newEmail.trim(),
        role: newRole,
        useLDAP: newUseLdap,
        businessUnitId: newBusinessUnitId,
        divisionId: newDivisionId,
        departmentId: newDepartmentId,
        password: newUseLdap ? undefined : newPassword.trim(),
      });
      setSubmittingUser(false);

      if (!createResult.success) {
        window.alert(createResult.message || "Gagal membuat user");
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
      role: newRole,
      businessUnitId: newBusinessUnitId,
      divisionId: newDivisionId,
      departmentId: newDepartmentId,
      isActive: newStatus === "Active",
    });

    if (!updateResult.success) {
      setSubmittingUser(false);
      window.alert(updateResult.message || "Gagal memperbarui user");
      return;
    }

    if (newUseLdap !== editingUser.UseLDAP) {
      const ldapResult = await toggleUserLdap(editingUser.UserId, newUseLdap);
      if (!ldapResult.success) {
        setSubmittingUser(false);
        window.alert(ldapResult.message || "Gagal memperbarui LDAP user");
        return;
      }
    }

    if (!newUseLdap && newPassword.trim()) {
      const passwordResult = await setUserPassword(editingUser.UserId, newPassword.trim());
      if (!passwordResult.success) {
        setSubmittingUser(false);
        window.alert(passwordResult.message || "Gagal memperbarui password user");
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
                    <td colSpan={8}>Tidak ada data user</td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.UserId}>
                      <td>{user.NPK || user.Username || "-"}</td>
                      <td>{user.DisplayName}</td>
                      <td>{user.Email}</td>
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

      {showCreateModal ? (
        <div className={styles.modalOverlay} onClick={resetUserForm} role="presentation">
          <div
            className={`${styles.modalCard} ${styles.wideModalCard}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editingUser ? "Edit User" : "Create User"}
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingUser ? "Edit User" : "Create User"}</h2>
              <button className={styles.modalClose} onClick={resetUserForm} type="button">
                x
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalGridTwo}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>LDAP User</label>
                  <button
                    type="button"
                    className={`${styles.toggleSwitch} ${newUseLdap ? styles.toggleSwitchOn : ""}`}
                    onClick={() => setNewUseLdap((prev) => !prev)}
                    aria-pressed={newUseLdap}
                    aria-label={`LDAP User ${newUseLdap ? "enabled" : "disabled"}`}
                  >
                    <span className={styles.toggleThumb} />
                  </button>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Username</label>
                  <input
                    className={styles.input}
                    placeholder="username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>NPK</label>
                  <input
                    className={styles.input}
                    placeholder="Nomor NPK"
                    value={newNpk}
                    onChange={(e) => setNewNpk(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Full Name</label>
                  <input
                    className={styles.input}
                    placeholder="Nama user"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email</label>
                  <input
                    className={styles.input}
                    placeholder="user@company.co.id"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Role</label>
                  <Dropdown
                    className={styles.select}
                    options={[
                      { value: "SuperAdmin", label: "Super Admin" },
                      { value: "AdminEvent", label: "Admin Event" },
                      { value: "ITLead", label: "IT Lead" },
                      { value: "DepartmentHead", label: "Dept Head" },
                    ]}
                    value={newRole}
                    onChange={(value) => setNewRole(value as typeof newRole)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Business Unit</label>
                  <Dropdown
                    className={styles.select}
                    options={[
                      { value: "", label: "Pilih Business Unit" },
                      ...businessUnits.map((businessUnit) => ({
                        value: businessUnit.BusinessUnitId,
                        label: businessUnit.Name,
                      })),
                    ]}
                    value={newBusinessUnitId}
                    onChange={setNewBusinessUnitId}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Divisi</label>
                  <Dropdown
                    className={styles.select}
                    options={[
                      { value: "", label: "Pilih Divisi" },
                      ...filteredDivisions.map((division) => ({
                        value: division.DivisionId,
                        label: division.Name,
                      })),
                    ]}
                    value={newDivisionId}
                    onChange={setNewDivisionId}
                    disabled={!newBusinessUnitId}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Department</label>
                  <Dropdown
                    className={styles.select}
                    options={[
                      { value: "", label: "Pilih Department" },
                      ...filteredDepartments.map((department) => ({
                        value: department.DepartmentId,
                        label: department.Name,
                      })),
                    ]}
                    value={newDepartmentId}
                    onChange={setNewDepartmentId}
                    disabled={!newDivisionId}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Status</label>
                  <Dropdown
                    className={styles.select}
                    options={[
                      { value: "Active", label: "Active" },
                      { value: "Inactive", label: "Inactive" },
                    ]}
                    value={newStatus}
                    onChange={setNewStatus}
                  />
                </div>
                {!newUseLdap ? (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Password</label>
                    <input
                      className={styles.input}
                      placeholder="Masukkan password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={resetUserForm} type="button">
                Cancel
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onSubmitUser} disabled={submittingUser} type="button">
                {submittingUser ? (editingUser ? "Saving..." : "Creating...") : (editingUser ? "Save" : "Create")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
    </>
  );
}
























