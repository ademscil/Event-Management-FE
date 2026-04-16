# Release Notes — CSI Portal

## v1.0.0 (April 2026)

### Added

**Core Platform**
- Next.js 16 App Router frontend dengan TypeScript dan CSS Modules
- Node.js + Express backend dengan MSSQL (SQL Server)
- JWT authentication dengan HttpOnly cookie refresh token
- Role-based access control: SuperAdmin, AdminEvent, ITLead, DepartmentHead
- Session management via sessionStorage dengan auto-clear pada logout

**Event Management**
- CRUD event/survey (create, edit, delete, status management)
- Survey builder dengan tipe pertanyaan: rating, text, numeric, date, matrix, comment
- Konfigurasi tampilan survey (hero image, logo, warna, font, multi-page)
- Generate public link dan QR code untuk distribusi survey
- Schedule blast email dan reminder (once/daily/weekly/monthly)
- Preview survey sebelum publish

**Approval Workflow**
- Approval Admin: review responden, duplicate check, approve/reject ke IT Lead
- Approval IT Lead: final approve response, propose takeout, feedback best comments
- Best Comments: seleksi komentar terbaik, feedback IT Lead per function

**Report**
- Generate laporan per event dengan statistik (total responden, avg score, distribusi rating)
- View report dengan filter BU/Divisi/Dept/Function/Aplikasi
- Export Excel (.xlsx) dan PDF (print view)
- Propose Takeout Score Comparison (before vs after per question)

**Master Data**
- Master BU, Divisi, Departemen, Function, Aplikasi
- Master User dengan role assignment
- Upload/download template Excel untuk semua master data
- Mapping Dept→Aplikasi dan Function→Aplikasi

**Audit Trail**
- Log seluruh aktivitas sistem (Create, Update, Delete, Login, Logout, Approve, Reject, Export)
- Filter by action, entity type, date range, username, IP address
- Pagination server-side

**Accessibility & UX**
- Loading state, empty state, dan error state di semua halaman admin
- 401 auto-redirect ke login page
- `aria-label` pada semua input dan tombol aksi
- `role="dialog"` dan `aria-modal="true"` pada semua modal
- `scope="col"` pada semua header tabel
- Responsive tabel dengan `overflow-x: auto`

**Performance**
- Database indexes pada tabel Responses, QuestionResponses, AuditLogs, ScheduledOperations
- `useCallback` untuk fungsi loadData yang digunakan sebagai dependency useEffect

### Fixed

- `reloadRespondents` dan `reloadTakeouts` di approval-admin sekarang clear error sebelum reload
- `loadData` di best-comments di-wrap dengan `useCallback` untuk dependency array yang benar
- `buildAuthHeaders` di auth.ts diberi komentar deprecation yang jelas

### Infrastructure

- SQL migration 001–028 untuk setup database lengkap
- Environment config via `.env` / `.env.local`
- `.gitignore` lengkap untuk FE dan BE

---

## v0.9.0 (Maret 2026) — Internal Beta

### Added
- Semua halaman master data dengan upload/download template Excel
- Mapping Dept→Aplikasi dan Function→Aplikasi
- Approval flow end-to-end (Admin Event → IT Lead)
- Report generation dan export

### Fixed
- Normalisasi role string (case-insensitive matching)
- Handling nullable date fields di survey

---

## v0.8.0 (Februari 2026) — Alpha

### Added
- Auth flow lengkap (login, logout, refresh token, forgot/reset password)
- Event management CRUD
- Survey builder dasar
- Master data BU, Divisi, Dept, Function, Aplikasi
- Public survey form (page1–page4)

---

## v0.5.0 (Januari 2026) — Proof of Concept

### Added
- Struktur project FE (Next.js) dan BE (Express)
- Database schema awal (migration 001–010)
- Login page dan dashboard skeleton
- Role-based navigation
