"use client";

import AdminHeader from "@/components/layout/admin-header";
import AdminSidebar from "@/components/layout/admin-sidebar";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { adminNavigation } from "@/config/navigation";
import { validateSession } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./admin-shell.module.css";

interface AdminShellProps {
  children: ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarState, setSidebarState] = useState<{ open: boolean; route: string }>({
    open: false,
    route: "",
  });

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

  const currentRoute = pathname || "";
  const hideSidebar = pathname?.startsWith("/admin/event-management/survey-create");
  const sidebarOpen = !hideSidebar && sidebarState.open && sidebarState.route === currentRoute;

  const closeSidebar = () => {
    setSidebarState((prev) => (prev.open ? { ...prev, open: false } : prev));
  };

  const toggleSidebar = () => {
    setSidebarState((prev) => {
      if (prev.open && prev.route === currentRoute) return { ...prev, open: false };
      return { open: true, route: currentRoute };
    });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Memuat sesi...
      </div>
    );
  }

  const menu = adminNavigation.filter((item) => item.roles.includes(user.role));

  return (
    <div className={styles.root}>
      <AdminHeader user={user} onMenuToggle={toggleSidebar} />

      <div className={styles.container}>
        {!hideSidebar && sidebarOpen ? (
          <div
            className={`${styles.sidebarOverlay} ${styles.sidebarOverlayVisible}`}
            onClick={closeSidebar}
          />
        ) : null}
        {!hideSidebar ? (
          <AdminSidebar
            menu={menu}
            pathname={pathname || ""}
            isOpen={sidebarOpen}
            onClose={closeSidebar}
          />
        ) : null}
        <main className={styles.content}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
