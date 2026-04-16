# Technical Document — CSI Portal

## Stack Detail

### Frontend

| Item | Detail |
|---|---|
| Framework | Next.js 16.x (App Router) |
| Language | TypeScript 5.x |
| Styling | CSS Modules (zero runtime) |
| State | React `useState` / `useEffect` / `useCallback` / `useMemo` |
| HTTP | Native `fetch` API dengan wrapper auth |
| Node | 20.x LTS |

### Backend

| Item | Detail |
|---|---|
| Runtime | Node.js 20.x LTS |
| Framework | Express 4.x |
| Language | JavaScript (CommonJS) |
| ORM/Driver | `mssql` (node-mssql) |
| Auth | `jsonwebtoken`, `bcryptjs` |
| Email | `nodemailer` |
| Validation | `express-validator` |
| Logging | `winston` |
| Testing | `jest` + `supertest` |

### Database

| Item | Detail |
|---|---|
| Engine | Microsoft SQL Server 2019+ |
| Database | `CSI` |
| Driver | `mssql` v10.x |

---

## Struktur Direktori

### Frontend (`csi-dev-FE/`)

```
src/
├── app/
│   ├── (admin)/admin/          # Admin panel pages (App Router)
│   │   ├── dashboard/
│   │   ├── event-management/
│   │   ├── report/
│   │   ├── approval-admin/
│   │   ├── approval-it-lead/
│   │   ├── best-comments/
│   │   ├── audit-trail/
│   │   ├── master-bu/
│   │   ├── master-divisi/
│   │   ├── master-department/
│   │   ├── master-function/
│   │   ├── master-aplikasi/
│   │   ├── master-user/
│   │   ├── dept-aplikasi/
│   │   └── function-aplikasi/
│   ├── admin/login/            # Login page
│   └── survey/                 # Public survey pages
├── components/
│   ├── admin/                  # Admin-specific components
│   └── common/                 # Shared components (Dropdown, etc.)
├── config/
│   └── navigation.ts           # Role-based navigation config
├── lib/
│   ├── auth.ts                 # Session management, login/logout
│   ├── fetch-with-auth.ts      # 401 auto-redirect wrapper
│   ├── surveys.ts              # Event/survey API calls
│   ├── approvals.ts            # Approval workflow API calls
│   ├── reports.ts              # Report API calls
│   ├── master-data.ts          # Master data API calls
│   ├── users.ts                # User management API calls
│   ├── mappings.ts             # Mapping API calls
│   ├── operations.ts           # Scheduled operations API calls
│   └── audit.ts                # Audit trail API calls
└── types/                      # TypeScript type definitions
```

### Backend (`csi-dev-BE/`)

```
src/
├── controllers/                # Route handlers
├── middleware/                 # Auth, audit, rate-limit, CORS
├── routes/                     # Express router definitions
├── services/                   # Business logic
├── database/
│   ├── connection.js           # MSSQL connection pool
│   └── migrations/             # SQL migration files (001–028)
└── utils/                      # Helper utilities
```

---

## Auth Flow

```
1. POST /api/v1/auth/login
   → Validate credentials (LDAP or local bcrypt)
   → Issue JWT access token (15m) + refresh token (7d)
   → Set HttpOnly cookie: csi_refresh_token
   → Return: { success, user, accessToken }

2. FE stores:
   - accessToken → sessionStorage (csi_token)
   - user object → sessionStorage (csi_user)
   - session marker → sessionStorage (csi_session_present)

3. Subsequent requests:
   → Authorization: Bearer <accessToken>
   → credentials: "include" (sends cookie)

4. Token refresh:
   → POST /api/v1/auth/refresh (cookie auto-sent)
   → Returns new accessToken

5. 401 response:
   → clearSession() → redirect to /admin/login

6. Logout:
   → POST /api/v1/auth/logout
   → Server invalidates refresh token
   → FE clears sessionStorage
```

---

## API Base Path & Environment Config

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_BASE_PATH=http://localhost:3000/api/v1
```

### Backend (`.env`)

```env
PORT=3000
NODE_ENV=development
DB_SERVER=localhost
DB_NAME=CSI
DB_USER=sa
DB_PASSWORD=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
FRONTEND_URL=http://localhost:3001
```

---

## Database Schema Overview

### Core Tables

| Tabel | Deskripsi |
|---|---|
| `Users` | User accounts dengan role (SuperAdmin, AdminEvent, ITLead, DepartmentHead) |
| `BusinessUnits` | Master BU |
| `Divisions` | Master Divisi (FK: BusinessUnits) |
| `Departments` | Master Departemen (FK: Divisions) |
| `Functions` | Master Function (IT Lead ownership) |
| `Applications` | Master Aplikasi |
| `Surveys` | Event/Survey header |
| `Questions` | Pertanyaan per survey |
| `Responses` | Response header per responden |
| `QuestionResponses` | Jawaban per pertanyaan (dengan TakeoutStatus) |
| `AuditLogs` | Log aktivitas sistem |
| `ScheduledOperations` | Jadwal blast/reminder email |
| `PublishCycles` | Siklus publish survey |

### Mapping Tables

| Tabel | Deskripsi |
|---|---|
| `FunctionApplicationMappings` | Function → Aplikasi |
| `DepartmentApplicationMappings` | Departemen → Aplikasi |
| `SurveyAdminAssignments` | Survey → Admin Event assignments |

---

## Deployment Notes

1. **Build FE**: `npm run build` di `csi-dev-FE/`
2. **Start FE**: `npm start` (port 3001) atau `npm run dev` untuk development
3. **Start BE**: `node server.js` atau `npm start` di `csi-dev-BE/` (port 3000)
4. **Database**: Jalankan migration SQL secara berurutan dari `001` sampai `028`
5. **Environment**: Copy `.env.example` → `.env` dan isi semua variabel
6. **Reverse proxy**: Nginx/IIS direkomendasikan untuk production (proxy FE ke BE)

Lihat `csi-dev-BE/docs/runbook.md` untuk detail operasional.
