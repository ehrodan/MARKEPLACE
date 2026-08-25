import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronDown, FileCode2, LockKeyhole, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@midas/ui";
import { BrandWordmark } from "@/components/brand-wordmark";
import { getScreenContract } from "@/lib/screen-contracts";
import styles from "./screen-contract-page.module.css";

const sectionNames: Record<string, string> = {
  PUB: "Experiência pública",
  ACC: "Conta e identidade",
  BUY: "Compra e pós-compra",
  SEL: "Operação do vendedor",
  ADM: "Administração",
  MST: "Governança Master",
  GRW: "Growth multi-tenant",
};

/**
 * Superfície "em preparação" (RF-279, docs/03 §10): apresenta a tela como
 * produto — propósito humano em display, ações previstas do contrato e CTAs
 * reais para /market e /ajuda — sem inventar dado nem fingir capability.
 * O contrato técnico completo NÃO foi apagado: vive no <details> ao final.
 */
export function ScreenContractPage({ screenId }: { screenId: string }) {
  const contract = getScreenContract(screenId);
  if (!contract) notFound();

  const embedded = contract.group === "ADM" || contract.group === "MST" || contract.route.startsWith("/conta/");
  // Apresentação apenas: o texto integral de `actions` segue verbatim no contrato técnico.
  const plannedActions = contract.actions
    .split(";")
    .map((action) => action.trim().replace(/\.$/, ""))
    .filter(Boolean);

  return (
    <section className={`${styles.page} ${embedded ? styles.embedded : ""}`} aria-labelledby={`${screenId}-title`}>
      {!embedded ? (
        <header className={styles.topbar}>
          <BrandWordmark />
          <Link className="text-link" href="/conta">Minha conta</Link>
        </header>
      ) : null}

      <div className={styles.content}>
        <div className={styles.meta}>
          <span className={styles.kicker}>{contract.id} · {sectionNames[contract.group]}</span>
          <StatusBadge tone="info">Em preparação</StatusBadge>
        </div>

        <h1 id={`${screenId}-title`} className={styles.title}>{contract.purpose}</h1>

        <p className={styles.honest}>Esta superfície ainda não opera; nada aqui é simulado.</p>

        <p className={styles.willLabel} id={`${screenId}-will`}>O que esta tela fará</p>
        <ul className={styles.willList} aria-labelledby={`${screenId}-will`}>
          {plannedActions.map((action, index) => (
            <li key={`${String(index)}-${action}`}>{action}</li>
          ))}
        </ul>

        <div className={styles.ctas}>
          <Link className="button-link" href="/market">
            Explorar o marketplace <ArrowRight aria-hidden="true" size={16} />
          </Link>
          <Link className="text-link" href="/ajuda">Central de ajuda</Link>
        </div>

        <details className={styles.contract}>
          <summary className={styles.summary}>
            <FileCode2 aria-hidden="true" size={15} />
            Contrato técnico da tela
            <ChevronDown aria-hidden="true" size={15} className={styles.chevron} />
          </summary>
          <div className={styles.contractBody}>
            <dl>
              <div><dt>URL</dt><dd><code>{contract.route}</code></dd></div>
              <div><dt>Acesso</dt><dd>{contract.access}</dd></div>
              <div><dt>Fonte canônica</dt><dd>{contract.source}</dd></div>
              <div><dt>Ações previstas</dt><dd>{contract.actions}</dd></div>
              <div><dt>Documentação</dt><dd>{contract.documentedStatus}</dd></div>
              <div>
                <dt>Estado operacional</dt>
                <dd>
                  Capability de domínio ainda não publicada. A rota e o contrato existem, mas esta superfície
                  não inventa registros, métricas nem ações; a operação permanece bloqueada até API,
                  autorização e testes do domínio estarem disponíveis.
                </dd>
              </div>
              <div>
                <dt>Mutações</dt>
                <dd>
                  CONTRACT_REQUIRED — nenhuma mutação foi liberada. A próxima entrega deve conectar esta tela
                  à fonte canônica indicada acima e manter default deny.
                </dd>
              </div>
            </dl>
            <p className={styles.contractNotes}>
              <span><LockKeyhole aria-hidden="true" size={14} /> Sem dados demonstrativos</span>
              <span><ShieldCheck aria-hidden="true" size={14} /> Autorização revalidada pela API quando implementada</span>
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
