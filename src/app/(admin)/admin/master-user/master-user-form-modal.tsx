"use client";

import { Dropdown } from "@/components/common/dropdown";
import type {
  BusinessUnitOption,
  DepartmentOption,
  DivisionOption,
} from "@/lib/org-hierarchy";
import type { UserListItem } from "@/types/user";
import styles from "../page-mockup.module.css";

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
  if (!showCreateModal) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={`${styles.modalCard} ${styles.wideModalCard}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editingUser ? "Edit User" : "Create User"}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{editingUser ? "Edit User" : "Create User"}</h2>
          <button className={styles.modalClose} onClick={onClose} type="button">
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
              <label className={styles.label}>Phone Number</label>
              <input
                className={styles.input}
                placeholder="6281234567890"
                value={newPhoneNumber}
                onChange={(e) => setNewPhoneNumber(e.target.value)}
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
                onChange={(value) => setNewRole(value as UserRole)}
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
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onSubmit} disabled={submittingUser} type="button">
            {submittingUser ? (editingUser ? "Saving..." : "Creating...") : (editingUser ? "Save" : "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}
