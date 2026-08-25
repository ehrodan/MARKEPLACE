"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, PageState, Panel, StatusBadge } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useApiResource } from "@/hooks/use-api-resource";
import type { CursorPage, PurchaseListItem } from "@/lib/api-types";
import { formatDateTime } from "@/lib/date-format";
import { DataProvenance } from "@/components/account/data-provenance";
import {
  MAX_SCORE,
  MIN_SCORE,
  REVIEW_WINDOW_DAYS,
  isValidScore,
  reviewableOrders,
} from "./review-eligibility";
import styles from "./reputation.module.css";

/**
 * SCR-ACC-015 — avaliações bilaterais.
 *
 * A elegibilidade é derivada de fato real: `GET /v1/me/purchases` devolve o
 * status e a data de conclusão de cada pedido, e a regra em
 * `review-eligibility.ts` decide quem pode avaliar o quê.
 *
 * O envio ainda não tem endpoint (`OrderReview` não está publicado). Então o
 * formulário existe, valida e explica — e o botão diz com honestidade que a
 * capability de envio não foi liberada. Botão que finge enviar avaliação é
 * pior que botão ausente: a pessoa acha que avaliou.
 */

function ScoreSelector({
  value,
  onChange,
  disabled,
  orderId,
}: {
  value: number | null;
  onChange: (score: number) => void;
  disabled: boolean;
  orderId: string;
}) {
  const scores = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_unused, index) => MIN_SCORE + index);
  return (
    <fieldset className={styles.scoreField} disabled={disabled}>
      {/* radiogroup real, com nome acessível por valor. Estrela puramente
          visual não é selecionável por teclado nem lida por leitor de tela. */}
      <legend>Sua nota de {MIN_SCORE} a {MAX_SCORE}</legend>
      <div className={styles.scoreOptions}>
        {scores.map((score) => (
          <label className={styles.scoreOption} key={score}>
            <input
              type="radio"
              name={`score-${orderId}`}
              value={score}
              checked={value === score}
              onChange={() => { onChange(score); }}
            />
            <span>{score}</span>
          </label>
        ))}
      </div>
      <p className={styles.scoreHint}>
        Nota {MIN_SCORE} é uma avaliação válida e será publicada como qualquer outra.
      </p>
    </fieldset>
  );
}

export function ReviewsView() {
  const resource = useApiResource<CursorPage<PurchaseListItem>>("/v1/me/purchases");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  const now = useMemo(() => new Date(), []);
  const entries = useMemo(
    () => (resource.status === "ready" ? reviewableOrders(resource.data.data, now) : []),
    [resource, now],
  );

  const header = (
    <PageHeader
      eyebrow="MINHA CONTA · REPUTAÇÃO"
      title="Avaliações"
      description="Avalie pedidos concluídos em que você foi parte. Sua nota fica selada até o outro lado enviar ou o prazo fechar."
    />
  );

  if (resource.status !== "ready") {
    return (
      <div className={styles.pageStack}>
        {header}
        {resource.status === "error"
          ? <ResourceError error={resource.error} retry={resource.retry} />
          : <ResourceLoading label="Carregando pedidos avaliáveis" />}
      </div>
    );
  }

  const eligible = entries.filter((entry) => entry.eligibility.eligible);

  return (
    <div className={styles.pageStack}>
      {header}
      <DataProvenance
        source="GET /v1/me/purchases"
        scope="somente pedidos em que você é comprador"
        asOf={resource.data.asOf}
      />

      {/* O duplo cego é a razão de a pessoa confiar na nota que lê no site.
          Explicar isso aumenta a taxa de avaliação: some o medo de retaliação. */}
      <Panel as="section" className={styles.doubleBlind}>
        <strong>Como a avaliação funciona aqui</strong>
        <ul>
          <li>Sua nota fica <strong>selada</strong> até o outro lado enviar a dele ou o prazo terminar.</li>
          <li>Nenhum lado vê a nota do outro antes disso, então ninguém avalia em resposta.</li>
          <li>Reputação de comprador e de vendedor são separadas e nunca somadas.</li>
          <li>A janela para avaliar é de {REVIEW_WINDOW_DAYS} dias após a conclusão do pedido.</li>
        </ul>
      </Panel>

      {!entries.length ? (
        <PageState
          kind="empty"
          title="Nenhum pedido para avaliar"
          description="Quando um pedido seu for concluído pelas duas confirmações de entrega, ele aparece aqui."
          actions={<Link className="button-link" href="/conta/compras">Ver minhas compras</Link>}
        />
      ) : (
        <section className={styles.list} aria-label="Pedidos e elegibilidade de avaliação">
          <p className={styles.counter} role="status">
            {eligible.length === 1
              ? "1 pedido pode ser avaliado agora"
              : `${String(eligible.length)} pedidos podem ser avaliados agora`}
            {entries.length > eligible.length
              ? ` · ${String(entries.length - eligible.length)} com motivo declarado`
              : ""}
          </p>

          {entries.map(({ order, eligibility }) => {
            const score = scores[order.orderId] ?? null;
            return (
              <Panel as="article" className={styles.card} key={order.orderId}>
                <header className={styles.cardHeader}>
                  <div>
                    <strong>Pedido {order.publicCode}</strong>
                    <small>
                      {order.completedAt
                        ? `Concluído em ${formatDateTime(order.completedAt)}`
                        : "Data de conclusão não informada pelo servidor"}
                    </small>
                  </div>
                  {eligibility.eligible ? (
                    <StatusBadge tone="success">Pode avaliar</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">Indisponível</StatusBadge>
                  )}
                </header>

                {!eligibility.eligible ? (
                  // Motivo sempre visível. Card sem explicação faz a pessoa
                  // achar que o sistema esqueceu dela.
                  <p className={styles.reason}>{eligibility.message}</p>
                ) : (
                  <>
                    <p className={styles.deadline}>
                      Prazo para avaliar: {formatDateTime(eligibility.deadline.toISOString())}
                    </p>
                    <ScoreSelector
                      orderId={order.orderId}
                      value={score}
                      disabled={false}
                      onChange={(next) => { setScores((current) => ({ ...current, [order.orderId]: next })); }}
                    />
                    <label className={styles.commentField}>
                      <span>Comentário (opcional)</span>
                      <textarea
                        value={comments[order.orderId] ?? ""}
                        maxLength={2000}
                        rows={3}
                        onChange={(event) => {
                          setComments((current) => ({ ...current, [order.orderId]: event.target.value }));
                        }}
                        placeholder="Descreva a experiência: item conforme o anúncio, comunicação, prazo."
                      />
                      <small>Não inclua dados pessoais seus nem do outro lado.</small>
                    </label>

                    <div className={styles.cardActions}>
                      <Button disabled>
                        {isValidScore(score) ? "Enviar avaliação" : "Escolha uma nota"}
                      </Button>
                      <Link className="text-link" href={`/conta/compras/${encodeURIComponent(order.orderId)}`}>
                        Ver o pedido
                      </Link>
                    </div>
                    <p className={styles.blocked}>
                      O envio depende da publicação de <code>OrderReview</code> na API. Nada é
                      enviado nem guardado enquanto isso — a nota que você escolher aqui não sai
                      desta tela.
                    </p>
                  </>
                )}
              </Panel>
            );
          })}
        </section>
      )}
    </div>
  );
}
