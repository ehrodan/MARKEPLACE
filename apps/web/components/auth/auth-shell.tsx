import type { ReactNode } from "react";
import { BrandWordmark } from "@/components/brand-wordmark";
import { BRAND } from "@/lib/brand";

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main id="conteudo-principal" className="auth-page">
      <aside className="auth-aside" aria-label="Apresentação da plataforma">
        <BrandWordmark />
        <div className="auth-aside__copy">
          <span className="eyebrow">IDENTIDADE ÚNICA</span>
          <h1>{BRAND.tagline}</h1>
          <p>Uma conta para comprar e, quando habilitada, operar um ou mais contextos de venda com escopo explícito.</p>
        </div>
        <small>Credenciais nunca aparecem em mensagens, métricas ou logs da interface.</small>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <header className="auth-card__header"><h2>{title}</h2><p>{description}</p></header>
          {children}
        </div>
      </section>
    </main>
  );
}
