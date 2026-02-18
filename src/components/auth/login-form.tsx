"use client";

import { login } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./login-form.module.css";

interface LoginFormProps {
  nextTarget: string;
}

export default function LoginForm({ nextTarget }: LoginFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ username: "", password: "" });

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

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img className={styles.logo} src="/assets/img/logo.png" alt="IT Survey Logo" />
          <h1 className={styles.title}>Portal Event Management</h1>
          <p className={styles.subtitle}>Masuk ke sistem manajemen event</p>
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
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            &copy; 2026 Portal Event Management. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
