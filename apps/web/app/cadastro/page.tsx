import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegistrationForm } from "@/components/auth/registration-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function RegistrationPage() {
  return <AuthShell title="Crie sua identidade" description="O cadastro é único: ele serve para comprar e pode ser habilitado para vender sem duplicar credenciais."><RegistrationForm termsVersion={process.env.NEXT_PUBLIC_TERMS_VERSION?.trim()} /></AuthShell>;
}
