import Link from "next/link";
import { notFound } from "next/navigation";
import { LockKeyhole, Route, ServerOff, ShieldCheck } from "lucide-react";
import { PageState, Panel, StatusBadge } from "@midas/ui";
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

export function ScreenContractPage({ screenId }: { screenId: string }) {
  const contract = getScreenContract(screenId);
  if (!contract) notFound();

  const embedded = contract.group === "ADM" || contract.group === "MST" || contract.route.startsWith("/conta/");
  return (
    <section className={`${styles.page} ${embedded ? styles.embedded : ""}`} aria-labelledby={`${screenId}-title`}>
      {!embedded ? (
        <header className={styles.topbar}>
          <Link href="/" aria-label="Voltar ao início"><BrandWordmark /></Link>
          <Link className="text-link" href="/conta">Minha conta</Link>
        </header>
      ) : null}

      <div className={styles.content}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>{contract.id} · {sectionNames[contract.group]}</span>
            <h1 id={`${screenId}-title`}>{contract.purpose}</h1>
          </div>
          <StatusBadge tone={contract.documentedStatus === "DOCUMENTADO" ? "info" : "warning"}>
            {contract.documentedStatus}
          </StatusBadge>
        </div>

        <div className={styles.grid}>
          <Panel className={styles.contractCard}>
            <div className={styles.cardTitle}><Route aria-hidden="true" size={18} /> Contrato da rota</div>
            <dl>
              <div><dt>URL</dt><dd><code>{contract.route}</code></dd></div>
              <div><dt>Acesso</dt><dd>{contract.access}</dd></div>
              <div><dt>Fonte canônica</dt><dd>{contract.source}</dd></div>
              <div><dt>Ações previstas</dt><dd>{contract.actions}</dd></div>
            </dl>
          </Panel>

          <Panel className={styles.guardCard}>
            <div className={styles.guardIcon}><ServerOff aria-hidden="true" size={22} /></div>
            <div>
              <span>Estado operacional real</span>
              <h2>Capability de domínio ainda não publicada</h2>
              <p>
                A rota e o contrato existem, mas esta superfície não inventa registros, métricas nem ações.
                A operação permanece bloqueada até API, autorização e testes do domínio estarem disponíveis.
              </p>
            </div>
          </Panel>
        </div>

        <PageState
          kind="unavailable"
          title="CONTRACT_REQUIRED"
          description="Nenhuma mutação foi liberada. A próxima entrega deve conectar esta tela à fonte canônica indicada acima e manter default deny."
          reference={contract.id}
          actions={
            <div className={styles.actions}>
              <Link className="button-link" href="/">Voltar ao início</Link>
              <Link className="text-link" href="/ajuda">Central de ajuda</Link>
            </div>
          }
        />

        <footer className={styles.footer}>
          <span><LockKeyhole aria-hidden="true" size={15} /> Sem dados demonstrativos</span>
          <span><ShieldCheck aria-hidden="true" size={15} /> Autorização revalidada pela API quando implementada</span>
        </footer>
      </div>
    </section>
  );
}
