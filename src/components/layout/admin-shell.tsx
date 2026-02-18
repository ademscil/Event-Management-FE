"use client";

import { adminNavigation } from "@/config/navigation";
import { logout, validateSession } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./admin-shell.module.css";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w.charAt(0).toUpperCase()).join("");
}

function menuGroup(label: string): "MAIN" | "EVENT" | "MASTER" {
  if (label === "Dashboard") return "MAIN";
  if (label === "Event Management") return "EVENT";
  return "MASTER";
}

function menuIconClass(label: string): string {
  if (label === "Dashboard") return styles.menuDashboard;
  if (label === "Event Management") return styles.menuEvent;
  return styles.menuMasterUser;
}

interface AdminShellProps {
  children: ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const sessionUser = await validateSession();
      if (!mounted) return;

      if (!sessionUser) {
        const next = encodeURIComponent(pathname || "/admin/dashboard");
        router.replace(`/login?next=${next}`);
        return;
      }

      setUser(sessionUser);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Memuat sesi...
      </div>
    );
  }

  const menu = adminNavigation.filter((item) => item.roles.includes(user.role));
  const groupedMenu = menu.reduce<Record<string, typeof menu>>((acc, item) => {
    const group = menuGroup(item.label);
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <Link className={styles.logoLink} href="/admin/dashboard">
            <img className={styles.logo} src="/assets/img/logo.png" alt="Logo" />
            <span>IT Survey Admin</span>
          </Link>
        </div>
        <div ref={userMenuRef} className={styles.userWrap}>
          <button
            type="button"
            className={styles.userButton}
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
          >
            <span>{user.displayName || initials(user.username)}</span>
            <span>▾</span>
          </button>
          {isUserMenuOpen ? (
            <div className={styles.userMenu}>
              <button
                type="button"
                className={styles.userMenuItem}
                onClick={onLogout}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className={styles.container}>
        <aside className={styles.sidebar}>
          <ul className={styles.menu}>
            {(["MAIN", "EVENT", "MASTER"] as const).map((groupName) => (
              <li key={groupName}>
                <div className={styles.menuTitle}>{groupName}</div>
                {(groupedMenu[groupName] || []).map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        styles.menuLink,
                        menuIconClass(item.label),
                        active ? styles.menuLinkActive : "",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </li>
            ))}
          </ul>
        </aside>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
