import Link from "next/link";
import { redirect } from "next/navigation";

export default async function PublicSurveyIndex({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  if (id) {
    redirect(`/survey/${encodeURIComponent(id)}`);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#f8fafc" }}>
      <div style={{ maxWidth: "560px", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "24px", background: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "28px", color: "#0f172a" }}>Survey Link Tidak Valid</h1>
        <p style={{ marginTop: "12px", color: "#475569", lineHeight: 1.6 }}>
          Parameter survey tidak ditemukan. Gunakan link survey yang valid dari email blast atau halaman operations.
        </p>
        <Link href="/login" style={{ display: "inline-block", marginTop: "12px", color: "#125ba1", fontWeight: 600 }}>
          Kembali ke portal
        </Link>
      </div>
    </main>
  );
}
