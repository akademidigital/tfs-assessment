# Taruna Future Scanner (TFS)

Aplikasi Asesmen Kesiapan Calon Taruna (AKPOL, AKMIL, dan Sekolah Kedinasan).
Dibangun dengan TanStack Start, React 19, Tailwind CSS, dan PostgreSQL (Supabase / Prisma).

## Fitur

- 9 Modul Asesmen Psikometrik Terstandar
- Penghitungan Skor Real-time & Dimensi Kesiapan
- Unduh Laporan Asesmen PDF Lengkap
- Penyimpanan Data Peserta & Hasil Asesmen di PostgreSQL

## Menjalankan di Lokal

```bash
bun install # atau npm install
bun run dev # atau npm run dev
```

## Deployment ke Vercel

Aplikasi ini siap di-deploy langsung ke Vercel:

1. Hubungkan repository ke project baru di Vercel.
2. Tambahkan environment variable yang dibutuhkan (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dll).
3. Build command: `vite build` (atau `npm run build`).
