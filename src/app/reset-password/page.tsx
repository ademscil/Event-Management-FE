"use client";

import { resetPassword } from "@/lib/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import styles from "./reset-password.module.css";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = String(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ error: "", message: "" });

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!token) {
      setFeedback({ error: "Token reset password tidak ditemukan", message: "" });
      return;
    }

    if (password.trim().length < 8) {
      setFeedback({ error: "Password baru minimal 8 karakter", message: "" });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ error: "Konfirmasi password tidak sama", message: "" });
      return;
    }

    setLoading(true);
    setFeedback({ error: "", message: "" });
    const result = await resetPassword(token, password);
    setLoading(false);

    if (!result.success) {
      setFeedback({ error: result.message || "Gagal mereset password", message: "" });
      return;
    }

    setFeedback({ error: "", message: result.message || "Password berhasil direset" });
    window.setTimeout(() => {
      router.replace("/login");
    }, 1200);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset Password</h1>
        <p className={styles.subtitle}>Buat password baru untuk akun user local CSI Web App.</p>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label} htmlFor="password">
            Password Baru
          </label>
          <input
            id="password"
            type="password"
            className={styles.input}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimal 8 karakter"
          />

          <label className={styles.label} htmlFor="confirmPassword">
            Konfirmasi Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            className={styles.input}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Ulangi password baru"
          />

          {feedback.error ? <div className={styles.errorBox}>{feedback.error}</div> : null}
          {feedback.message ? <div className={styles.successBox}>{feedback.message}</div> : null}

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "Memproses..." : "Reset Password"}
          </button>
        </form>

        <Link className={styles.backLink} href="/login">
          Kembali ke Login
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.card}>Memuat reset password...</div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
