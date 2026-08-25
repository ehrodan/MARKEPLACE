import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "@/components/brand-wordmark";
import { SellerAccountForm } from "@/components/seller/seller-account-form";

export const metadata: Metadata = { title: "Começar a vender" };

export default function SellerRegistrationPage() {
  return <main id="conteudo-principal" className="seller-registration"><header className="seller-registration__header"><BrandWordmark /><Link className="text-link" href="/conta">Voltar para Minha conta</Link></header><section className="seller-registration__content"><header className="page-header"><div className="page-header__copy"><span className="eyebrow">VENDEDOR · ETAPA DISPONÍVEL</span><h1>Crie seu contexto de venda.</h1><p>Sua identidade continua única; a SellerAccount delimita operação, permissões e dados comerciais.</p></div></header><SellerAccountForm /></section></main>;
}
