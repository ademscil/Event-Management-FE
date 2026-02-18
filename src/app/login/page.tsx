import LoginForm from "@/components/auth/login-form";

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextTarget = params.next || "/admin/dashboard";
  return <LoginForm nextTarget={nextTarget} />;
}
