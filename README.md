# CSI Frontend (Next.js)

Frontend baru berbasis Next.js App Router untuk menggantikan halaman statis lama.

## Prasyarat

- Backend CSI berjalan di `http://localhost:3000`
- Node.js 20+

## Setup

1. Salin environment:

```bash
cp .env.local.example .env.local
```

2. Install dependency:

```bash
npm install
```

3. Jalankan frontend di port `3001`:

```bash
npm run dev:3001
```

4. Buka:

`http://localhost:3001/login`

## Cakupan Migrasi Saat Ini

- Halaman Login
- App layout admin (sidebar + header + logout)
- Dashboard baseline: `/admin/dashboard`
- Placeholder route:
  - `/admin/event-management`
  - `/admin/master-user`

## Catatan Teknis

- Frontend memanggil API melalui path `/api/*`.
- `next.config.ts` me-rewrite request ke backend `BACKEND_INTERNAL_URL`.
- Session disimpan di localStorage agar kompatibel dengan backend auth existing.
