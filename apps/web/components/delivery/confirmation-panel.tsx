"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CircleCheck, CircleDashed, Scale, UserRound } from "lucide-react";
import { Button, Panel, PanelKicker, StatusBadge } from "@midas/ui";
import {
  UNPUBLISHED_CAPABILITIES,
  confirmAvailability,
  confirmedAtOf,
  formatAbsoluteInstant,
  hasPartyConfirmed,
  partyLabel,
  type DeliveryParty,
  type DeliveryPayload,
  type DeliveryState,
  type OrderPayload,
} from "./delivery-state";
import styles from "./delivery.module.css";

export interface ConfirmationPanelProps {
  order: OrderPayload;
  delivery: DeliveryPayload | null;
  state: DeliveryState;
  viewer: DeliveryParty | null;
  confirming: boolean;
  actionError: string | null;
  onConfirm: () => void;
  /** Caminho verificável de conflito enquanto a API não publica as rotas. */
  helpHref: string;
}

function confirmationSentence(
  delivery: DeliveryPayload | null,
  party: DeliveryParty,
  isViewer: boolean,
): string {
  const who = isViewer
    ? "Sua confirmação"
    : `Confirmação do ${partyLabel(party).toLocaleLowerCase("pt-BR")}`;
  if (!hasPartyConfirmed(delivery, party)) return `${who}: ainda não registrada.`;
  const moment = formatAbsoluteInstant(confirmedAtOf(delivery, party));
  return moment ? `${who}: registrada em ${moment}.` : `${who}: registrada.`;
}

function ConfirmationCard({
  delivery,
  party,
  isViewer,
}: {
  delivery: DeliveryPayload | null;
  party: DeliveryParty;
  isViewer: boolean;
}) {
  const confirmed = hasPartyConfirmed(delivery, party);
  const iso = confirmedAtOf(delivery, party);
  const moment = formatAbsoluteInstant(iso);
  const heading = isViewer
    ? `Sua confirmação (${partyLabel(party).toLocaleLowerCase("pt-BR")})`
    : `Confirmação do ${partyLabel(party).toLocaleLowerCase("pt-BR")}`;

  return (
    <li className={styles.confirmationCard} data-viewer={isViewer ? "true" : "false"}>
      <span className={styles.confirmationIcon} aria-hidden="true">
        {confirmed ? <CircleCheck size={20} /> : <CircleDashed size={20} />}
      </span>
      <div className={styles.confirmationBody}>
        <strong>{heading}</strong>
        <StatusBadge tone={confirmed ? "success" : "neutral"}>
          {confirmed ? "Registrada" : "Não registrada"}
        </StatusBadge>
        <p>
          {confirmed ? (
            moment && iso ? (
              <>
                Registrada em <time dateTime={iso}>{moment}</time>.
              </>
            ) : (
              "Registrada. O servidor não informou o horário."
            )
          ) : isViewer ? (
            "Nada foi registrado no seu nome até agora."
          ) : (
            "A outra parte ainda não registrou a confirmação dela. Ela decide sozinha, no tempo dela."
          )}
        </p>
      </div>
    </li>
  );
}

export function ConfirmationPanel({
  order,
  delivery,
  state,
  viewer,
  confirming,
  actionError,
  onConfirm,
  helpHref,
}: ConfirmationPanelProps) {
  const baseId = useId();
  const confirm = confirmAvailability({ order, delivery, viewer });

  const [deliberating, setDeliberating] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const buyerConfirmed = hasPartyConfirmed(delivery, "BUYER");
  const sellerConfirmed = hasPartyConfirmed(delivery, "SELLER");
  const previousRef = useRef<string | null>(null);

  useEffect(() => {
    const signature = `${String(buyerConfirmed)}|${String(sellerConfirmed)}|${state}`;
    if (previousRef.current === null) {
      previousRef.current = signature;
      return;
    }
    if (previousRef.current === signature) return;
    previousRef.current = signature;
    setAnnouncement(
      `${confirmationSentence(delivery, "BUYER", viewer === "BUYER")} ${confirmationSentence(delivery, "SELLER", viewer === "SELLER")}`,
    );
  }, [buyerConfirmed, sellerConfirmed, state, delivery, viewer]);

  const confirmLabel =
    viewer === "SELLER"
      ? `Confirmar que entreguei o pedido ${order.publicCode}`
      : `Confirmar que recebi o pedido ${order.publicCode}`;

  // Quando o papel não foi verificado, comprador vem primeiro por convenção de
  // leitura — nunca por hierarquia entre as partes.
  const first: DeliveryParty = viewer ?? "BUYER";
  const second: DeliveryParty = first === "BUYER" ? "SELLER" : "BUYER";

  return (
    <Panel as="section" className={styles.confirmationPanel} aria-labelledby={`${baseId}-title`}>
      <PanelKicker>CONFIRMAÇÃO DUPLA INDEPENDENTE</PanelKicker>
      <h2 id={`${baseId}-title`} className={styles.panelTitle}>
        Cada lado confirma o seu
      </h2>
      <p className={styles.panelLead}>
        Comprador e vendedor registram confirmações separadas. Uma confirmação não dispara, não
        substitui e não obriga a outra. Enquanto as duas não existirem — e não houver disputa — o
        pedido não é concluído nem os valores entram em retenção.
      </p>

      <ul className={styles.confirmationGrid} aria-label="Estado das duas confirmações">
        <ConfirmationCard delivery={delivery} party={first} isViewer={viewer !== null} />
        <ConfirmationCard delivery={delivery} party={second} isViewer={false} />
      </ul>

      <p className="ui-visually-hidden" aria-live="polite" data-testid="delivery-confirmation-live">
        {announcement}
      </p>

      {actionError ? (
        <p className={styles.actionError} role="alert">
          <AlertTriangle aria-hidden="true" size={16} /> {actionError}
        </p>
      ) : null}

      <div className={styles.actionRow}>
        <div className={styles.actionSlot}>
          <Button
            size="large"
            fullWidth
            aria-disabled={confirm.allowed ? undefined : true}
            aria-describedby={confirm.allowed ? undefined : `${baseId}-confirm-reason`}
            loading={confirming}
            loadingLabel="Registrando sua confirmação"
            iconBefore={<CircleCheck aria-hidden="true" size={18} />}
            onClick={() => {
              if (!confirm.allowed) return;
              setDeliberating((open) => !open);
              setAcknowledged(false);
            }}
          >
            {confirmLabel}
          </Button>
          {confirm.allowed ? null : (
            <p className={styles.actionReason} id={`${baseId}-confirm-reason`}>
              {confirm.reason}
            </p>
          )}
        </div>

        <div className={styles.actionSlot}>
          <Link className={`button-link ${styles.exitAction}`} href={helpHref}>
            <AlertTriangle aria-hidden="true" size={18} />
            Reportar problema no pedido {order.publicCode}
          </Link>
          <p className={styles.actionReason}>{UNPUBLISHED_CAPABILITIES.reportProblem}</p>
        </div>

        <div className={styles.actionSlot}>
          <Link className={`button-link ${styles.exitAction}`} href={helpHref}>
            <Scale aria-hidden="true" size={18} />
            Abrir disputa do pedido {order.publicCode}
          </Link>
          <p className={styles.actionReason}>{UNPUBLISHED_CAPABILITIES.openDispute}</p>
        </div>
      </div>

      <p className={styles.exitNote}>
        <UserRound aria-hidden="true" size={15} /> Confirmar, reportar problema e abrir disputa ficam
        sempre nesta tela, no mesmo lugar e com o mesmo destaque. Nenhuma delas é escondida para
        empurrar a confirmação.
      </p>

      {deliberating && confirm.allowed ? (
        <div
          className={styles.deliberateBox}
          role="group"
          aria-labelledby={`${baseId}-confirm-step`}
        >
          <strong id={`${baseId}-confirm-step`}>Confirmação definitiva</strong>
          <p>
            {viewer === "SELLER"
              ? "Você declara que entregou o combinado. A confirmação é registrada em seu nome e não é desfeita por esta tela."
              : "Você declara que conferiu o que recebeu e que está de acordo. A confirmação é registrada em seu nome e não é desfeita por esta tela."}{" "}
            Se o outro lado também já tiver confirmado, o pedido é concluído e a retenção dos
            valores do vendedor começa.
          </p>
          <label className={styles.checkboxRow} htmlFor={`${baseId}-ack`}>
            <input
              id={`${baseId}-ack`}
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => {
                setAcknowledged(event.target.checked);
              }}
            />
            <span>Li a consequência e quero registrar minha confirmação.</span>
          </label>
          <div className={styles.deliberateActions}>
            <Button
              disabled={!acknowledged}
              loading={confirming}
              loadingLabel="Registrando sua confirmação"
              onClick={() => {
                onConfirm();
              }}
            >
              Registrar minha confirmação definitiva do pedido {order.publicCode}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDeliberating(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
