import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeReturnTo } from "@/lib/auth-validation";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ retorno?: string }> }) {
  const query = await searchParams;
  return <AuthShell title="Entre na sua conta" description="Use suas credenciais para continuar. A mensagem de erro não confirma se um endereço está cadastrado."><LoginForm returnTo={safeReturnTo(query.retorno)} /></AuthShell>;
}
