"use client";

import { adminNavigation } from "@/config/navigation";
import { logout, validateSession } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./admin-shell.module.css";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w.charAt(0).toUpperCase()).join("");
}

function menuIconClass(icon: string): string {
  switch (icon) {
    case "dashboard":
      return styles.menuDashboard;
    case "eventManagement":
      return styles.menuEvent;
    case "report":
      return styles.menuReport;
    case "approvalAdmin":
      return styles.menuApproval;
    case "bestComments":
      return styles.menuBestComments;
    case "masterBu":
      return styles.menuMasterBu;
    case "masterDivisi":
      return styles.menuMasterDivisi;
    case "masterDepartment":
      return styles.menuMasterDepartment;
    case "masterFunction":
      return styles.menuMasterFunction;
    case "masterAplikasi":
      return styles.menuMasterAplikasi;
    case "mappingDeptAplikasi":
      return styles.menuMapping;
    case "mappingFunctionAplikasi":
      return styles.menuMapping;
    case "masterUser":
      return styles.menuMasterUser;
    default:
      return styles.menuDashboard;
  }
}

interface AdminShellProps {
  children: ReactNode;
}

const menuOrder = ["MAIN", "EVENT", "APPROVAL", "MASTER", "MAPPING"] as const;

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
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
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
            <Image className={styles.logo} src="/assets/img/logo.png" alt="Logo" width={28} height={28} priority />
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
            {menuOrder.map((groupName) => {
              const items = groupedMenu[groupName] || [];
              if (items.length === 0) return null;

              return (
                <li key={groupName}>
                  <div className={styles.menuTitle}>{groupName}</div>
                  {items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          styles.menuLink,
                          menuIconClass(item.icon),
                          active ? styles.menuLinkActive : "",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        </aside>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}



