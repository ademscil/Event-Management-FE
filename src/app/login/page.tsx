import LoginForm from "@/components/auth/login-form";

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

function normalizeNextTarget(next?: string): string {
  if (!next || typeof next !== "string") return "/admin/dashboard";
  if (!next.startsWith("/")) return "/admin/dashboard";

  const normalized = next.replace("/admin/event_management", "/admin/event-management");

  const allowedPrefixes = [
    "/admin/dashboard",
    "/admin/event-management",
    "/admin/master-user",
    "/admin/report",
    "/admin/approval-admin",
    "/admin/best-comments",
    "/admin/master-bu",
    "/admin/master-divisi",
    "/admin/master-department",
    "/admin/master-function",
    "/admin/master-aplikasi",
    "/admin/dept-aplikasi",
    "/admin/function-aplikasi",
  ];

  const allowed = allowedPrefixes.some((prefix) => normalized.startsWith(prefix));
  return allowed ? normalized : "/admin/dashboard";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextTarget = normalizeNextTarget(params.next);
  return <LoginForm nextTarget={nextTarget} />;
}
