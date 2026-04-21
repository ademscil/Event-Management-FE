# Release Notes — CSI Portal

## v1.0.4 (April 2026)

### Changed

**Audit Trail — UI Overhaul**
- Redesain halaman audit trail dengan layout baru yang lebih informatif dan konsisten dengan halaman admin lainnya
- Tambah stats cards di bagian atas: ringkasan total log, aksi terbanyak, dan periode aktif (CSS: `.statsGrid`, `.statCard`, `.statLabel`, `.statValue`, `.statSub`)
- Filter panel dipisah menjadi komponen tersendiri dengan header, grid input, dan tombol aksi (CSS: `.filterPanel`, `.filterPanelHead`, `.filterGrid`, `.filterInput`, `.filterSelect`, `.btnReset`, `.btnApply`)
- Tabel dipindah ke dalam panel dengan header dan meta info (CSS: `.tablePanel`, `.tablePanelHead`, `.tableWrap`, `.table`)
- Tambah row indicator berupa dot berwarna per jenis aksi: Create (hijau), Update (biru), Delete (merah), Login/Logout, Export, dll. (CSS: `.rowIndicator`, `.dot`, `.dotCreate`, `.dotUpdate`, `.dotDelete`, dst.)
- Badge aksi diperbarui dengan warna yang lebih spesifik per jenis aksi (CSS: `.badgeCreate`, `.badgeUpdate`, `.badgeDelete`, `.badgeLogin`, `.badgeLogout`, `.badgeLoginFailed`, `.badgeApprove`, `.badgeReject`, `.badgeExport`, `.badgeAccess`)
- Tambah cell helper untuk kolom waktu, user, entity, IP, dan user-agent (CSS: `.cellTime`, `.cellTimeSub`, `.cellUser`, `.cellEntity`, `.cellEntitySub`, `.cellIp`, `.cellUa`)
- Tombol detail baris diganti dengan `.btnView` (indigo)
- Empty state dan loading/error row dengan tampilan yang lebih jelas (CSS: `.emptyState`, `.emptyIcon`, `.emptyText`, `.emptySubtext`, `.loadingRow`, `.errorRow`)
- Pagination dipindah ke dalam panel dengan kontrol halaman yang lebih lengkap (CSS: `.pagination`, `.paginationInfo`, `.paginationControls`, `.pageBtn`, `.pageBtnActive`)
- Modal detail diperbarui: header dengan badge aksi, subtitle, backdrop blur, dan shadow lebih dalam; body dibagi per section dengan detail grid dan JSON block yang lebih rapi (CSS: `.modalCard`, `.modalHeader`, `.modalHeaderLeft`, `.modalActionBadge`, `.modalSubtitle`, `.detailSection`, `.detailSectionTitle`, `.detailGrid`, `.detailItem`, `.jsonSection`, `.jsonHeader`, `.jsonLabel`, `.jsonPre`)
- Responsive: stats grid 2 kolom, filter dan detail grid 1 kolom, pagination stack vertikal pada layar ≤ 768px

---

## v1.0.3 (April 2026)

### Added

**Operations — Email Tab (Blast / Reminder)**
- Tambah tab bar di panel email operations untuk beralih antara mode Blast dan Reminder
- Layout dua kolom untuk form email dengan footer aksi di bawah
- Implementasi via CSS Modules: kelas `.emailTabBar`, `.emailTab`, `.emailTabActive`, `.emailForm`, `.emailFormDesc`, `.emailFormGrid`, `.emailFormCol`, `.emailFormFooter`, `.emailSubmitBtn`
- Responsive: grid dua kolom collapse ke satu kolom dan tombol submit full-width pada layar ≤ 900px

---

## v1.0.2 (April 2026)

### Added

**Survey Builder — Preview Screen**
- Tambah tampilan preview penuh di Survey Builder (`survey-create`) untuk melihat hasil survey sebelum publish
- Device switcher: tab Desktop dan Mobile di topbar preview
- Viewport Desktop: lebar penuh hingga 860px dengan border dan shadow
- Viewport Mobile: frame 390px dengan border tebal menyerupai perangkat mobile (border-radius 40px)
- Preview merender semua tipe pertanyaan:
  - Rating (tombol angka dengan state aktif)
  - Text / Numeric / Date (input field)
  - Dropdown (select)
  - Pilihan ganda — vertikal dan horizontal (radio/checkbox item)
  - Matrix (tabel dengan header kolom dan baris)
  - Signature (canvas dengan border dashed)
  - Hero cover (gambar atau placeholder gradient)
- Pertanyaan dikelompokkan per halaman survey dengan header section
- Pertanyaan per aplikasi ditampilkan dalam grup berwarna biru
- Responsive: topbar wrap dan viewport mobile menyesuaikan layar ≤ 900px
- Implementasi via CSS Modules: kelas `.previewScreen`, `.previewTopbar`, `.previewDeviceTabs`, `.previewViewport`, `.previewViewportDesktop`, `.previewViewportMobile`, `.previewPage`, `.previewQuestion`, `.previewRatingRow`, `.previewMatrixTable`, `.signatureCanvas`, dll.

---

## v1.0.1 (April 2026)

### Changed

**Public Survey UI**
- Tambah brand badge logo Astra Otoparts di pojok kanan atas kartu survey publik
- Badge ditampilkan di semua survey secara konsisten (hardcoded, tidak bergantung konfigurasi event)
- Implementasi via CSS Modules: `.brandBadge` (container absolut dengan backdrop semi-transparan) dan `.brandBadgeLogo` (gambar logo 28px)
- `.card` diberi `position: relative` sebagai anchor untuk badge

---

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
