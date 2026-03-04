# Progress Tracker (VS Code)

Referensi status utama ada di:
- `docs/progress-board.json`
- Prompt kerja terbaru:
  - `docs/codex-prompt-updated.md`

## Ringkasan terbaru (2026-02-27)
- `B2` done: LDAP login flow + create/edit user LDAP stabil.
- `B3` on_progress: Swagger/OpenAPI + Postman sudah ada, coverage endpoint penuh masih lanjut.
- `B12` on_progress: Survey Builder stabilisasi lanjut (preview full-page, device switch, grouped follow-up per app, conditional comment rule, logo/style save config).
- `B13` on_progress: rule metadata pertanyaan makin lengkap, validasi full-rule masih ongoing.
- `B14` on_progress: flow responden bertingkat + mapped app lebih stabil, penyamaan renderer publish final masih lanjut.

## Checklist release per sesi
- Mapping task ke `Time Plan` + `Time Plan Detail` sebelum coding.
- Small patch + validasi tiap tahap.
- Cek impact lintas role: SuperAdmin, AdminEvent, ITLead, DeptHead.
- Update `docs/progress-board.json` setelah task selesai.
- Jika perlu merge: feature -> development (default), merge ke main hanya jika diminta eksplisit.
- Pantau GitHub Actions sampai `success`.

## Command helper (CMD)

```cmd
scripts\check-progress.cmd show
```

```cmd
scripts\check-progress.cmd update B12 on_progress "Update note"
```
