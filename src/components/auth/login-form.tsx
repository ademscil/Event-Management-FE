"use client";

import { login, requestPasswordReset } from "@/lib/auth";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./login-form.module.css";

interface LoginFormProps {
  nextTarget: string;
}

const loginSubtitles = [
  "Masuk ke sistem manajemen event",
  "Kelola event, respon, dan report dalam satu portal",
];

export default function LoginForm({ nextTarget }: LoginFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ username: "", password: "" });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState({ error: "", message: "" });
  const [typedSubtitle, setTypedSubtitle] = useState("");

  useEffect(() => {
    const fullText = loginSubtitles[0];
    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      setTypedSubtitle(fullText.slice(0, frame));
      if (frame >= fullText.length) {
        window.clearInterval(timer);
      }
    }, 35);

    return () => window.clearInterval(timer);
  }, []);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    const nextErrors = { username: "", password: "" };

    if (!form.username.trim()) {
      nextErrors.username = "Username harus diisi";
    }
    if (!form.password) {
      nextErrors.password = "Password harus diisi";
    }

    setErrors(nextErrors);
    if (nextErrors.username || nextErrors.password) {
      return;
    }

    setLoading(true);

    const result = await login(form.username, form.password);
    setLoading(false);

    if (!result.success) {
      setErrors({
        username: result.message || "Username atau password salah",
        password: "",
      });
      return;
    }

    router.replace(nextTarget);
  };

  const onSubmitForgotPassword: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!resetIdentifier.trim()) {
      setResetFeedback({
        error: "Email wajib diisi",
        message: "",
      });
      return;
    }

    setResetLoading(true);
    setResetFeedback({ error: "", message: "" });

    const result = await requestPasswordReset("email", resetIdentifier.trim());
    setResetLoading(false);

    if (!result.success) {
      setResetFeedback({
        error: result.message || "Gagal memproses forgot password",
        message: "",
      });
      return;
    }

    setResetFeedback({
      error: "",
      message: result.message || "Permintaan reset password berhasil diproses",
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.backdropGlow} />
      <div className={styles.card}>
        <div className={styles.header}>
          <Image className={styles.logo} src="/assets/img/logo.png" alt="IT Survey Logo" width={48} height={48} priority />
          <h1 className={styles.title}>Portal Event Management</h1>
          <p className={styles.subtitle}>
            {typedSubtitle}
            <span className={styles.cursor} aria-hidden="true" />
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              className={`${styles.input} ${errors.username ? styles.inputError : ""}`}
              value={form.username}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, username: event.target.value }))
              }
              placeholder="Masukkan username"
              autoComplete="username"
              required
            />
            <span className={styles.errorMessage}>{errors.username}</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              placeholder="Masukkan password"
              autoComplete="current-password"
              required
            />
            <span className={styles.errorMessage}>{errors.password}</span>
          </div>

          <button
            className={styles.button}
            type="submit"
            disabled={loading}
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <button
            className={styles.linkButton}
            type="button"
            onClick={() => {
              setShowForgotPassword(true);
              setResetIdentifier("");
              setResetFeedback({ error: "", message: "" });
            }}
          >
            Forgot Password
          </button>
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            &copy; 2026 Portal Event Management. All rights reserved.
          </p>
        </div>
      </div>

      {showForgotPassword ? (
        <div className={styles.modalOverlay} onClick={() => setShowForgotPassword(false)} role="presentation">
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Forgot Password">
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Forgot Password</h2>
              <button className={styles.modalClose} type="button" onClick={() => setShowForgotPassword(false)}>
                x
              </button>
            </div>
            <form className={styles.modalBody} onSubmit={onSubmitForgotPassword}>
              <p className={styles.modalCopy}>
                Reset password hanya berlaku untuk user local dengan <code>UseLDAP = 0</code>.
              </p>

              <div className={styles.methodTabs}>
                <button
                  type="button"
                  className={`${styles.methodTab} ${styles.methodTabActive}`}
                  onClick={() => {
                    setResetIdentifier("");
                    setResetFeedback({ error: "", message: "" });
                  }}
                >
                  By Email
                </button>
                <button
                  type="button"
                  className={`${styles.methodTab} ${styles.methodTabDisabled}`}
                  disabled
                  title="Reset password via phone dinonaktifkan sementara"
                >
                  By Phone
                </button>
              </div>

              <label className={styles.label} htmlFor="forgot-identifier">
                Email
              </label>
              <input
                id="forgot-identifier"
                className={`${styles.input} ${resetFeedback.error ? styles.inputError : ""}`}
                value={resetIdentifier}
                onChange={(event) => setResetIdentifier(event.target.value)}
                placeholder="user@company.co.id"
                autoComplete="email"
              />

              <p className={styles.helperText}>
                Masukkan email terdaftar. Jika cocok untuk user local, link reset akan dikirim ke email tersebut.
              </p>

              {resetFeedback.error ? <div className={styles.inlineError}>{resetFeedback.error}</div> : null}
              {resetFeedback.message ? <div className={styles.inlineSuccess}>{resetFeedback.message}</div> : null}

              <div className={styles.modalActions}>
                <button className={styles.secondaryButton} type="button" onClick={() => setShowForgotPassword(false)}>
                  Batal
                </button>
                <button className={styles.button} type="submit" disabled={resetLoading}>
                  {resetLoading ? "Memproses..." : "Kirim Link Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
