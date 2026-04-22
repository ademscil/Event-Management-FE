"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "inherit",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111" }}>
        Terjadi Kesalahan
      </h1>
      <p style={{ color: "#555", marginBottom: "1.5rem", maxWidth: 400 }}>
        Halaman tidak dapat dimuat. Silakan coba lagi atau hubungi administrator jika masalah berlanjut.
      </p>
      {error.digest ? (
        <p style={{ fontSize: "0.75rem", color: "#999", marginBottom: "1rem" }}>
          Error ID: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        style={{
          padding: "0.5rem 1.5rem",
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "0.9rem",
        }}
      >
        Coba Lagi
      </button>
    </div>
  );
}
