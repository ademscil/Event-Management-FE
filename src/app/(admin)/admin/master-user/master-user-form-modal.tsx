"use client";

import { Dropdown } from "@/components/common/dropdown";
import type {
  BusinessUnitOption,
  DepartmentOption,
  DivisionOption,
} from "@/lib/org-hierarchy";
import type { UserListItem } from "@/types/user";
import styles from "../page-mockup.module.css";
import modalStyles from "./master-user-modal.module.css";

type UserRole = "SuperAdmin" | "AdminEvent" | "ITLead" | "DepartmentHead";

interface MasterUserFormModalProps {
  businessUnits: BusinessUnitOption[];
  editingUser: UserListItem | null;
  filteredDepartments: DepartmentOption[];
  filteredDivisions: DivisionOption[];
  newBusinessUnitId: string;
  newDepartmentId: string;
  newDisplayName: string;
  newDivisionId: string;
  newEmail: string;
  newNpk: string;
  newPassword: string;
  newPhoneNumber: string;
  newRole: UserRole;
  newStatus: string;
  newUseLdap: boolean;
  newUsername: string;
  onClose: () => void;
  onSubmit: () => void;
  setNewBusinessUnitId: (value: string) => void;
  setNewDepartmentId: (value: string) => void;
  setNewDisplayName: (value: string) => void;
  setNewDivisionId: (value: string) => void;
  setNewEmail: (value: string) => void;
  setNewNpk: (value: string) => void;
  setNewPassword: (value: string) => void;
  setNewPhoneNumber: (value: string) => void;
  setNewRole: (value: UserRole) => void;
  setNewStatus: (value: string) => void;
  setNewUseLdap: React.Dispatch<React.SetStateAction<boolean>>;
  setNewUsername: (value: string) => void;
  showCreateModal: boolean;
  submittingUser: boolean;
}

export default function MasterUserFormModal({
  businessUnits,
  editingUser,
  filteredDepartments,
  filteredDivisions,
  newBusinessUnitId,
  newDepartmentId,
  newDisplayName,
  newDivisionId,
  newEmail,
  newNpk,
  newPassword,
  newPhoneNumber,
  newRole,
  newStatus,
  newUseLdap,
  newUsername,
  onClose,
  onSubmit,
  setNewBusinessUnitId,
  setNewDepartmentId,
  setNewDisplayName,
  setNewDivisionId,
  setNewEmail,
  setNewNpk,
  setNewPassword,
  setNewPhoneNumber,
  setNewRole,
  setNewStatus,
  setNewUseLdap,
  setNewUsername,
  showCreateModal,
  submittingUser,
}: MasterUserFormModalProps) {
  if (!showCreateModal) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={modalStyles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editingUser ? "Edit User" : "Create User"}
      >
        {/* Header */}
        <div className={modalStyles.header}>
          <div className={modalStyles.headerLeft}>
            <h2 className={modalStyles.title}>
              {editingUser ? "Edit User" : "Create User"}
            </h2>
            <p className={modalStyles.subtitle}>
              {editingUser
                ? "Perbarui informasi dan akses user"
                : "Tambah user baru ke sistem"}
            </p>
          </div>
          <button className={modalStyles.closeBtn} onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={modalStyles.body}>

          {/* Section: Autentikasi */}
          <div className={modalStyles.section}>
            <div className={modalStyles.sectionTitle}>Autentikasi</div>
            <div className={modalStyles.grid2}>
              {/* LDAP Toggle */}
              <div className={modalStyles.fieldFull}>
                <div className={modalStyles.ldapRow}>
                  <div>
                    <div className={modalStyles.fieldLabel}>LDAP User</div>
                    <div className={modalStyles.fieldHint}>
                      Aktifkan jika user login menggunakan akun LDAP perusahaan
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`${modalStyles.toggle} ${newUseLdap ? modalStyles.toggleOn : ""}`}
                    onClick={() => setNewUseLdap((prev) => !prev)}
                    aria-pressed={newUseLdap}
                    aria-label={`LDAP User ${newUseLdap ? "enabled" : "disabled"}`}
                  >
                    <span className={modalStyles.toggleThumb} />
                    <span className={modalStyles.toggleLabel}>
                      {newUseLdap ? "LDAP" : "Manual"}
                    </span>
                  </button>
                </div>
              </div>

              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel} htmlFor="mu-username">
                  Username <span className={modalStyles.required}>*</span>
                </label>
                <input
                  id="mu-username"
                  name="username"
                  className={modalStyles.input}
                  placeholder="contoh: adam.cid00676"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>

              {!newUseLdap ? (
                <div className={modalStyles.field}>
                  <label className={modalStyles.fieldLabel} htmlFor="mu-password">
                    Password {!editingUser && <span className={modalStyles.required}>*</span>}
                  </label>
                  <input
                    id="mu-password"
                    name="password"
                    className={modalStyles.input}
                    placeholder={editingUser ? "Kosongkan jika tidak diubah" : "Min. 8 karakter"}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Section: Informasi Pribadi */}
          <div className={modalStyles.section}>
            <div className={modalStyles.sectionTitle}>Informasi Pribadi</div>
            <div className={modalStyles.grid2}>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel} htmlFor="mu-npk">
                  NPK <span className={modalStyles.required}>*</span>
                </label>
                <input
                  id="mu-npk"
                  name="npk"
                  className={modalStyles.input}
                  placeholder="Nomor NPK"
                  value={newNpk}
                  onChange={(e) => setNewNpk(e.target.value)}
                />
              </div>

              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel} htmlFor="mu-name">
                  Nama Lengkap <span className={modalStyles.required}>*</span>
                </label>
                <input
                  id="mu-name"
                  name="displayName"
                  className={modalStyles.input}
                  placeholder="Nama lengkap user"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                />
              </div>

              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel} htmlFor="mu-email">
                  Email <span className={modalStyles.required}>*</span>
                </label>
                <input
                  id="mu-email"
                  name="email"
                  className={modalStyles.input}
                  placeholder="user@astraotoparts.co.id"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel} htmlFor="mu-phone">
                  No. Telepon
                </label>
                <input
                  id="mu-phone"
                  name="phoneNumber"
                  className={modalStyles.input}
                  placeholder="6281234567890"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section: Akses & Organisasi */}
          <div className={modalStyles.section}>
            <div className={modalStyles.sectionTitle}>Akses & Organisasi</div>
            <div className={modalStyles.grid2}>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel} htmlFor="mu-role">
                  Role <span className={modalStyles.required}>*</span>
                </label>
                <Dropdown
                  className={modalStyles.select}
                  options={[
                    { value: "SuperAdmin", label: "Super Admin" },
                    { value: "AdminEvent", label: "Admin Event" },
                    { value: "ITLead", label: "IT Lead" },
                    { value: "DepartmentHead", label: "Dept Head" },
                  ]}
                  value={newRole}
                  onChange={(value) => setNewRole(value as UserRole)}
                />
              </div>

              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel} htmlFor="mu-status">
                  Status
                </label>
                <Dropdown
                  className={modalStyles.select}
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Inactive", label: "Inactive" },
                  ]}
                  value={newStatus}
                  onChange={setNewStatus}
                />
              </div>

              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel} htmlFor="mu-bu">
                  Business Unit <span className={modalStyles.required}>*</span>
                </label>
                <Dropdown
                  className={modalStyles.select}
                  options={[
                    { value: "", label: "Pilih Business Unit" },
                    ...businessUnits.map((bu) => ({
                      value: bu.BusinessUnitId,
                      label: bu.Name,
                    })),
                  ]}
                  value={newBusinessUnitId}
                  onChange={setNewBusinessUnitId}
                />
              </div>

              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel} htmlFor="mu-divisi">
                  Divisi <span className={modalStyles.required}>*</span>
                </label>
                <Dropdown
                  className={`${modalStyles.select} ${!newBusinessUnitId ? modalStyles.selectDisabled : ""}`}
                  options={[
                    { value: "", label: "Pilih Divisi" },
                    ...filteredDivisions.map((div) => ({
                      value: div.DivisionId,
                      label: div.Name,
                    })),
                  ]}
                  value={newDivisionId}
                  onChange={setNewDivisionId}
                  disabled={!newBusinessUnitId}
                />
              </div>

              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel} htmlFor="mu-dept">
                  Department <span className={modalStyles.required}>*</span>
                </label>
                <Dropdown
                  className={`${modalStyles.select} ${!newDivisionId ? modalStyles.selectDisabled : ""}`}
                  options={[
                    { value: "", label: "Pilih Department" },
                    ...filteredDepartments.map((dept) => ({
                      value: dept.DepartmentId,
                      label: dept.Name,
                    })),
                  ]}
                  value={newDepartmentId}
                  onChange={setNewDepartmentId}
                  disabled={!newDivisionId}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={modalStyles.footer}>
          <span className={modalStyles.requiredNote}>
            <span className={modalStyles.required}>*</span> Wajib diisi
          </span>
          <div className={modalStyles.footerActions}>
            <button
              className={modalStyles.btnCancel}
              onClick={onClose}
              type="button"
              disabled={submittingUser}
            >
              Batal
            </button>
            <button
              className={modalStyles.btnSubmit}
              onClick={onSubmit}
              disabled={submittingUser}
              type="button"
            >
              {submittingUser
                ? (editingUser ? "Menyimpan..." : "Membuat...")
                : (editingUser ? "Simpan Perubahan" : "Buat User")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
