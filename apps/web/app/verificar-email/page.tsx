import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerificationForm } from "@/components/auth/verification-form";

export const metadata: Metadata = { title: "Verificar e-mail" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const query = await searchParams;
  return <AuthShell title="Confirme seu e-mail" description="A verificação conclui a criação da identidade antes do primeiro login."><VerificationForm initialToken={query.token} /></AuthShell>;
}
