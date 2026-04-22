# E2E Testing Checklist — CSI Portal
**Activity B.21: Integrasi E2E + Developer Testing**
**Tanggal:** 16–28 April 2026
**Environment:** FE http://localhost:3001 | BE http://localhost:3000

---

## Status Legend
- `[ ]` = Belum ditest
- `[✓]` = Pass
- `[✗]` = Fail (catat error di kolom Catatan)
- `[-]` = Skip / N/A

---

## 1. Auth & Session

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 1.1 | Login sebagai `superadmin` | Redirect ke dashboard, sidebar tampil menu: Dashboard, Event Management, Master User | [ ] | |
| 1.2 | Login sebagai `adminevent` | Redirect ke dashboard, sidebar tampil menu lengkap kecuali Master User | [ ] | |
| 1.3 | Login sebagai `itlead` | Redirect ke dashboard, sidebar hanya: Dashboard, Approval IT Lead | [ ] | |
| 1.4 | Login sebagai `depthead` | Redirect ke dashboard, sidebar hanya: Dashboard, Report, Best Comments | [ ] | |
| 1.5 | Login dengan password salah | Tampil pesan error, tidak redirect | [ ] | |
| 1.6 | Logout | Session terhapus, redirect ke login, tidak bisa back ke dashboard | [ ] | |
| 1.7 | Akses halaman admin tanpa login | Redirect ke login | [ ] | |

---

## 2. Master Data

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 2.1 | Master User — list tampil | Data user muncul di tabel | [ ] | |
| 2.2 | Master User — create user baru | User tersimpan, muncul di list | [ ] | |
| 2.3 | Master User — edit user | Perubahan tersimpan | [ ] | |
| 2.4 | Master User — activate/deactivate | Status berubah | [ ] | |
| 2.5 | Master BU — list tampil | Data BU muncul | [ ] | |
| 2.6 | Master BU — create/edit | Data tersimpan | [ ] | |
| 2.7 | Master Divisi — kolom BU di depan | Kolom BU tampil sebagai kolom pertama | [ ] | |
| 2.8 | Master Department — list tampil | Data muncul | [ ] | |
| 2.9 | Master Function — list tampil | Data muncul | [ ] | |
| 2.10 | Master Aplikasi — list tampil | Data muncul | [ ] | |

---

## 3. Event Management

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 3.1 | List event tampil | Daftar event muncul dengan status badge | [ ] | |
| 3.2 | Filter event by status | List terfilter | [ ] | |
| 3.3 | Search event | Hasil search muncul | [ ] | |
| 3.4 | Create event baru | Modal terbuka, event tersimpan, muncul di list | [ ] | |
| 3.5 | Edit event | Perubahan tersimpan | [ ] | |
| 3.6 | Delete event | ConfirmDialog muncul, event terhapus setelah konfirmasi | [ ] | |
| 3.7 | Klik "Survey Builder" dari event | Redirect ke halaman builder | [ ] | |
| 3.8 | Klik "Operations" dari event | Redirect ke halaman operations | [ ] | |

---

## 4. Survey Builder

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 4.1 | Halaman builder load | Pertanyaan existing tampil | [ ] | |
| 4.2 | Add question tipe Rating | Question tersimpan, muncul di list | [ ] | |
| 4.3 | Add question tipe Text | Question tersimpan | [ ] | |
| 4.4 | Add question tipe Dropdown | Question tersimpan dengan options | [ ] | |
| 4.5 | Edit question | Perubahan tersimpan | [ ] | |
| 4.6 | Delete question | ConfirmDialog muncul, question terhapus | [ ] | |
| 4.7 | Preview mode | Survey tampil dalam mode preview | [ ] | |
| 4.8 | Publish survey | Status berubah ke Active | [ ] | |

---

## 5. Operations (per Event)

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 5.1 | Generate survey link | Link muncul di input field | [ ] | |
| 5.2 | Copy link | Toast/message "berhasil disalin" | [ ] | |
| 5.3 | Generate QR code | Gambar QR muncul | [ ] | |
| 5.4 | Download QR | File PNG ter-download | [ ] | |
| 5.5 | Tab Embed — embed code muncul | Kode iframe tampil | [ ] | |
| 5.6 | Schedule Blast (once) | Muncul di Scheduled Operations table | [ ] | |
| 5.7 | Schedule Reminder (once) | Muncul di Scheduled Operations table | [ ] | |
| 5.8 | Cancel scheduled operation | ConfirmDialog muncul, status berubah ke Cancelled | [ ] | |

---

## 6. Public Survey (Responden)

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 6.1 | Akses `/survey/:surveyId` | Form survey tampil | [ ] | |
| 6.2 | Pilih BU → Divisi cascade | Dropdown Divisi terisi sesuai BU | [ ] | |
| 6.3 | Pilih Divisi → Dept cascade | Dropdown Dept terisi sesuai Divisi | [ ] | |
| 6.4 | Pilih aplikasi | Checkbox aplikasi tampil | [ ] | |
| 6.5 | Submit tanpa isi mandatory | Validasi error muncul | [ ] | |
| 6.6 | Submit lengkap | Response tersimpan, halaman sukses tampil | [ ] | |
| 6.7 | Submit duplikat (email + app sama) | Pesan duplikat muncul, tidak tersimpan | [ ] | |

---

## 7. Approval Admin (AdminEvent)

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 7.1 | Tab Daftar Responden — list tampil | Data responden muncul | [ ] | |
| 7.2 | Filter duplicate: "Duplicate Only" | Hanya responden duplikat tampil | [ ] | |
| 7.3 | Select responden + Approve Selected | Status berubah ke PendingITLead | [ ] | |
| 7.4 | Select responden + Reject Selected | Dialog alasan muncul, status berubah | [ ] | |
| 7.5 | Export to CSV | File CSV ter-download | [ ] | |
| 7.6 | Tab Propose Takeout — list tampil | Data proposed takeout muncul | [ ] | |
| 7.7 | Approve Takeout | Status takeout berubah | [ ] | |
| 7.8 | Reject Takeout | Dialog alasan muncul, status berubah | [ ] | |

---

## 8. Approval IT Lead

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 8.1 | Tab Propose Takeout — pending list tampil | Data pending IT Lead muncul | [ ] | |
| 8.2 | Approve Final Response | Status berubah ke ApprovedFinal | [ ] | |
| 8.3 | Propose Takeout | Dialog alasan muncul, data masuk ke Approval Admin | [ ] | |
| 8.4 | Tab Best Comments Feedback — list tampil | Best comments muncul | [ ] | |
| 8.5 | Submit feedback | Feedback tersimpan | [ ] | |

---

## 9. Best Comments (AdminEvent)

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 9.1 | Tab View Comments — list tampil | Komentar muncul | [ ] | |
| 9.2 | Mark best comment | Komentar ditandai | [ ] | |
| 9.3 | Unmark best comment | Tanda dihapus | [ ] | |
| 9.4 | Tab View Best Comments — list tampil | Best comments + feedback IT Lead muncul | [ ] | |

---

## 10. Report

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 10.1 | List event report tampil | Daftar event muncul | [ ] | |
| 10.2 | Generate Report | Status berubah ke Generated | [ ] | |
| 10.3 | View Report | Halaman report detail terbuka dengan data | [ ] | |
| 10.4 | Chart Applications Score tampil | Bar chart muncul | [ ] | |
| 10.5 | Function Detail table tampil | Tabel dengan rowspan muncul | [ ] | |
| 10.6 | Export Excel | File .xlsx ter-download | [ ] | |
| 10.7 | Export PDF | Print view terbuka | [ ] | |
| 10.8 | Takeout Comparison table | Data before/after muncul | [ ] | |

---

## 11. Audit Trail

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 11.1 | List audit log tampil | Log muncul dengan timestamp, user, action | [ ] | |
| 11.2 | Filter by date range | Log terfilter | [ ] | |
| 11.3 | Filter by action | Log terfilter | [ ] | |

---

## 12. Mapping

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 12.1 | Mapping Function→App — list tampil | Data mapping muncul | [ ] | |
| 12.2 | Tambah mapping | Mapping tersimpan | [ ] | |
| 12.3 | Hapus mapping | ConfirmDialog muncul, mapping terhapus | [ ] | |
| 12.4 | Mapping Dept→App — hierarchical view | BU > Divisi > Dept > App tampil | [ ] | |

---

## 13. Role Isolation

| # | Test Case | Expected | Status | Catatan |
|---|-----------|----------|--------|---------|
| 13.1 | DeptHead akses `/admin/event-management` | Redirect atau 403 | [ ] | |
| 13.2 | DeptHead akses `/admin/approval-admin` | Redirect atau 403 | [ ] | |
| 13.3 | ITLead akses `/admin/master-bu` | Redirect atau 403 | [ ] | |
| 13.4 | SuperAdmin akses `/admin/approval-admin` | Redirect atau 403 | [ ] | |
| 13.5 | SuperAdmin akses `/admin/report` | Redirect atau 403 | [ ] | |

---

## Ringkasan Hasil Testing

| Modul | Total | Pass | Fail | Skip |
|-------|-------|------|------|------|
| 1. Auth | 7 | | | |
| 2. Master Data | 10 | | | |
| 3. Event Management | 8 | | | |
| 4. Survey Builder | 8 | | | |
| 5. Operations | 8 | | | |
| 6. Public Survey | 7 | | | |
| 7. Approval Admin | 8 | | | |
| 8. Approval IT Lead | 5 | | | |
| 9. Best Comments | 4 | | | |
| 10. Report | 8 | | | |
| 11. Audit Trail | 3 | | | |
| 12. Mapping | 4 | | | |
| 13. Role Isolation | 5 | | | |
| **TOTAL** | **85** | | | |

---

## Bug Log

| # | Modul | Deskripsi Bug | Severity | Status |
|---|-------|---------------|----------|--------|
| | | | | |

---

## Catatan Meeting

_Diisi saat meeting mingguan_
