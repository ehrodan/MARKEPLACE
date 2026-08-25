"use client";

import { useId } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  LockKeyhole,
  PackageCheck,
  PackageOpen,
  ShieldCheck,
} from "lucide-react";
import { Panel, PanelKicker, StatusBadge } from "@midas/ui";
import {
  UNPUBLISHED_CAPABILITIES,
  describeDeliveryState,
  formatAbsoluteInstant,
  packageDisclosure,
  type DeliveryPayload,
  type DeliveryState,
  type OrderPayload,
} from "./delivery-state";
import styles from "./delivery.module.css";

export interface CustodyCardProps {
  order: OrderPayload;
  delivery: DeliveryPayload | null;
  state: DeliveryState;
}

/**
 * Os quatro passos descrevem o que o domínio de fato executa
 * (modules/orders/src/delivery-service.ts). Nenhum deles é promessa de
 * marketing: cada um corresponde a uma transição registrada em evento.
 */
const custodySteps = [
  "O pagamento confirmado abre a entrega em custódia da plataforma — o item não passa direto de um lado para o outro.",
  "A instrução autorizada é liberada uma única vez, e o servidor carimba o momento dessa liberação.",
  "Comprador e vendedor conferem e registram confirmações independentes; a primeira delas coloca o pedido em entrega.",
  "Com as duas confirmações e sem disputa, o pedido é concluído e os valores do vendedor entram em retenção.",
] as const;

function Milestone({ label, iso }: { label: string; iso: string | null }) {
  const formatted = formatAbsoluteInstant(iso);
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {formatted && iso ? (
          <time dateTime={iso}>{formatted}</time>
        ) : (
          "Não informado pelo servidor"
        )}
      </dd>
    </div>
  );
}

export function CustodyCard({ order, delivery, state }: CustodyCardProps) {
  const baseId = useId();
  const descriptor = describeDeliveryState(state);
  const disclosure = packageDisclosure(delivery);
  const releasedAtIso = delivery?.instructionRevealedAt ?? null;
  const releasedAt = formatAbsoluteInstant(releasedAtIso);

  return (
    <Panel as="section" className={styles.custodyCard} aria-labelledby={`${baseId}-title`}>
      <div className={styles.custodyHead}>
        <PanelKicker>ENTREGA SEGURA COM CUSTÓDIA</PanelKicker>
        <StatusBadge tone={descriptor.tone}>{descriptor.label}</StatusBadge>
      </div>

      <div className={styles.vault} aria-hidden="true">
        <span className={styles.vaultRing} />
        <LockKeyhole size={44} />
      </div>

      <h2 id={`${baseId}-title`} className={styles.panelTitle}>
        O pacote deste pedido fica em custódia da plataforma
      </h2>
      <p className={styles.panelLead}>{descriptor.explanation}</p>

      <div className={styles.howBox}>
        <strong>Como funciona a entrega segura</strong>
        <ul className={styles.howList}>
          {custodySteps.map((step) => (
            <li key={step}>
              <Check aria-hidden="true" size={16} /> <span>{step}</span>
            </li>
          ))}
        </ul>
        <p className={styles.howNote}>
          <ShieldCheck aria-hidden="true" size={15} /> Confirmar não transfere dinheiro na hora: o
          valor entra em retenção e segue as regras de saldo e saque do vendedor.
        </p>
      </div>

      <section className={styles.packageBox} aria-labelledby={`${baseId}-package`}>
        <h3 id={`${baseId}-package`}>Pacote / instrução autorizada</h3>

        <p className={styles.packageWarning}>
          <AlertTriangle aria-hidden="true" size={16} />
          <span>
            <strong>A liberação é de uso único.</strong> A instrução autorizada deste pedido é
            liberada uma vez só e o servidor registra o momento. Depois disso não existe revelar de
            novo — nem por esta tela, nem por recarregar a página. Guarde o conteúdo assim que
            tiver acesso a ele.
          </span>
        </p>

        {disclosure === "NOT_OPENED" ? (
          <p className={styles.packageNotice}>
            <LockKeyhole aria-hidden="true" size={16} />
            <span>
              A entrega ainda não foi aberta para o pedido {order.publicCode}. A custódia é criada
              quando o pagamento é confirmado; até lá não existe pacote a liberar e nada é exibido
              no lugar dele.
            </span>
          </p>
        ) : null}

        {disclosure === "SEALED" ? (
          <p className={styles.packageNotice}>
            <PackageOpen aria-hidden="true" size={16} />
            <span>
              A entrega está aberta, mas o servidor ainda não carimbou a liberação da instrução
              (<code>instructionRevealedAt</code> veio nulo). Enquanto esse carimbo não existir, a
              tela não afirma que houve liberação.
            </span>
          </p>
        ) : null}

        {disclosure === "RELEASED" && releasedAt && releasedAtIso ? (
          <p className={styles.packageNotice}>
            <PackageCheck aria-hidden="true" size={16} />
            <span>
              Liberação já consumida em <time dateTime={releasedAtIso}>{releasedAt}</time>. Este é o
              único registro de liberação deste pedido. Se você não recebeu o que estava combinado,
              o caminho é reportar problema ou abrir disputa — nunca pedir nova liberação.
            </span>
          </p>
        ) : null}

        <p className={styles.packageNotice}>
          <AlertTriangle aria-hidden="true" size={16} />
          <span>{UNPUBLISHED_CAPABILITIES.packageContent}</span>
        </p>
      </section>

      <dl className={styles.turnFacts}>
        <Milestone label="Pedido registrado" iso={order.placedAt} />
        <Milestone label="Pagamento confirmado" iso={order.paidAt} />
        <Milestone label="Custódia aberta" iso={delivery?.createdAt ?? null} />
        <Milestone label="Instrução liberada (uso único)" iso={releasedAtIso} />
      </dl>

      <p className={styles.deadline}>
        <CalendarClock aria-hidden="true" size={16} />
        <span>
          Todo marco acima é data e hora absolutas vindas do servidor. O contrato publicado não
          traz prazo de confirmação de entrega, então esta tela não exibe prazo nem contagem
          regressiva: nada de pressa fabricada.
        </span>
      </p>
    </Panel>
  );
}
