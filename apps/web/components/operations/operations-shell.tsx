"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Boxes,
  CircleGauge,
  Landmark,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@midas/ui";
import { BrandWordmark } from "@/components/brand-wordmark";
import styles from "./operations-shell.module.css";

const adminLinks = [
  { href: "/admin/catalogo", label: "Catálogo", icon: Boxes },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: BadgeDollarSign },
  { href: "/admin/saques", label: "Saques", icon: Landmark },
] as const;

const masterLinks = [
  { href: "/master", label: "Visão de controle", icon: CircleGauge },
  { href: "/admin/pagamentos", label: "Operar pagamentos", icon: BadgeDollarSign },
  { href: "/admin/saques", label: "Operar saques", icon: Landmark },
] as const;

function Rail({ mode, close }: { mode: "admin" | "master"; close?: () => void }) {
  const pathname = usePathname();
  const links = mode === "master" ? masterLinks : adminLinks;
  return (
    <>
      <div className={styles.brand}>
        <BrandWordmark />
        <span className={styles.mode}><ShieldCheck aria-hidden="true" size={13} />{mode === "master" ? "Governança master" : "Operação financeira"}</span>
      </div>
      <nav className={styles.nav} aria-label={mode === "master" ? "Navegação master" : "Navegação administrativa"}>
        <span className={styles.sectionLabel}>{mode === "master" ? "Controle" : "Filas operacionais"}</span>
        {links.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link className={styles.navLink} data-active={active || undefined} aria-current={active ? "page" : undefined} href={item.href} key={item.href} onClick={close}>
              <Icon aria-hidden="true" size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className={styles.footer}>
        <Link className={styles.navLink} href="/conta" onClick={close}>
          <UserRound aria-hidden="true" size={18} />
          <span>Minha conta</span>
        </Link>
      </div>
    </>
  );
}

export function OperationsShell({ children, mode }: { children: ReactNode; mode: "admin" | "master" }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const label = mode === "master" ? "Governança e configuração" : "Operação da plataforma";
  return (
    <div className={styles.shell}>
      <aside className={`${styles.rail} ${styles.desktopRail}`}><Rail mode={mode} /></aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarStart}>
            <Button ref={menuRef} className={styles.menuButton} size="small" variant="ghost" aria-label="Abrir navegação operacional" aria-haspopup="dialog" onClick={() => { dialogRef.current?.showModal(); }} iconBefore={<Menu aria-hidden="true" size={20} />}>Menu</Button>
            <div className={styles.title}><small>Área restrita</small><strong>{label}</strong></div>
          </div>
          <div className={styles.topbarMeta}><ShieldCheck aria-hidden="true" size={17} /><span>Ações revalidadas pela API</span></div>
        </header>
        <main id="conteudo-principal" className={styles.content}>{children}</main>
      </div>
      <dialog ref={dialogRef} className={styles.drawer} aria-label="Navegação operacional" onClose={() => { menuRef.current?.focus(); }}>
        <header className={styles.drawerHeader}>
          <strong>{mode === "master" ? "Master" : "Administração"}</strong>
          <Button variant="ghost" size="small" aria-label="Fechar navegação" onClick={() => { dialogRef.current?.close(); }} iconBefore={<X aria-hidden="true" size={20} />}>Fechar</Button>
        </header>
        <aside className={`${styles.rail} ${styles.drawerRail}`}><Rail mode={mode} close={() => { dialogRef.current?.close(); }} /></aside>
      </dialog>
    </div>
  );
}
