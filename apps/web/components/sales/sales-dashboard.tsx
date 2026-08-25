"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeInfo,
  Boxes,
  Lock,
  ScrollText,
  ShieldQuestion,
  Store,
} from "lucide-react";
import { Button, Freshness, PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useAccountContext } from "@/components/account/account-context";
import { SellerScopeGate } from "@/components/account/seller-scope-gate";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import {
  SalesMetricCard,
  formatMinorUnits,
  sumMinorUnits,
  type SalesMetric,
} from "./sales-metric-card";
import {
  SELLER_ORDERS_CONTRACT,
  SalesOrderTable,
  parseSellerOrderRows,
  sellerOrdersPath,
  type SellerOrderListItem,
  type SellerOrderPage,
} from "./sales-order-table";
import styles from "./sales.module.css";

const BALANCE_CONTRACT = "GET /v1/seller-accounts/{sellerAccountId}/finance/balance";

interface SellerBalance {
  sellerAccountId: string;
  currency: string;
  heldAmountMinor: string;
  availableAmountMinor: string;
  reservedAmountMinor: string;
  asOf: string;
}

/** Regras lidas de modules/finance/src/hold-policy.ts (evaluateHoldRelease). */
const holdGates: ReadonlyArray<{ code: string; title: string; detail: string }> = [
  {
    code: "HOLD_WINDOW_ACTIVE",
    title: "A janela de retenção ainda está correndo",
    detail:
      "A contagem começa na liquidação do pagamento e dura 168 horas (sete dias), conforme HOLD_DURATION_HOURS em modules/finance/src/hold-policy.ts.",
  },
  {
    code: "ORDER_NOT_COMPLETED",
    title: "O pedido ainda não foi concluído",
    detail: "Enquanto a entrega não é confirmada pelas duas partes, o valor não sai da retenção.",
  },
  {
    code: "PAYMENT_NOT_RECONCILED",
    title: "O pagamento ainda não foi conciliado",
    detail:
      "O provedor precisa confirmar a liquidação, ou um operador precisa conciliar manualmente, antes da liberação.",
  },
  {
    code: "DISPUTE_OPEN",
    title: "Existe disputa aberta neste pedido",
    detail: "A retenção segura o valor até a disputa ser decidida.",
  },
  {
    code: "CHARGEBACK_OPEN",
    title: "Existe chargeback aberto",
    detail: "O provedor pode reverter o pagamento, então o valor permanece retido.",
  },
  {
    code: "ACCOUNT_FROZEN",
    title: "A conta de venda está congelada",
    detail: "Nenhuma liberação ocorre enquanto o congelamento estiver ativo.",
  },
];

function ScopeStrip() {
  const { sellerAccounts, selectedSeller, selectSeller } = useAccountContext();
  if (!selectedSeller) return null;

  return (
    <section className={styles.scopeStrip} aria-labelledby="sales-scope-title">
      <div className={styles.scopeIdentity}>
        <Store aria-hidden="true" size={19} />
        <div>
          <h2 id="sales-scope-title" className={styles.scopeKicker}>
            Contexto de venda ativo
          </h2>
          <p className={styles.scopeName}>{selectedSeller.displayName}</p>
          <p className={styles.scopeMeta}>
            <code>{selectedSeller.sellerAccountId}</code>
            {selectedSeller.membershipRole ? <> · papel {selectedSeller.membershipRole}</> : null}
          </p>
        </div>
      </div>
      {sellerAccounts.length > 1 ? (
        <div className={styles.scopeSwitch}>
          <label htmlFor="sales-scope-select">Trocar contexto</label>
          <select
            id="sales-scope-select"
            value={selectedSeller.sellerAccountId}
            onChange={(event) => {
              selectSeller(event.target.value);
            }}
          >
            {sellerAccounts.map((seller) => (
              <option value={seller.sellerAccountId} key={seller.sellerAccountId}>
                {seller.displayName}
              </option>
            ))}
          </select>
          <p className={styles.scopeMeta}>
            Você participa de {sellerAccounts.length} contas de venda. Esta tela mostra apenas a conta
            selecionada acima.
          </p>
        </div>
      ) : (
        <p className={styles.scopeMeta}>
          Toda leitura desta tela é feita no escopo desta conta. A API revalida a sua participação a
          cada requisição.
        </p>
      )}
    </section>
  );
}

function BalancePanel({ sellerAccountId }: { sellerAccountId: string }) {
  const resource = useApiResource<SellerBalance>(
    `/v1/seller-accounts/${encodeURIComponent(sellerAccountId)}/finance/balance`,
  );

  return (
    <section className={styles.section} aria-labelledby="sales-balance-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="sales-balance-title">Saldo desta conta de venda</h2>
          <p>
            Três bolsos separados, cada um com o campo do contrato que o origina. Nada é somado num
            número único.
          </p>
        </div>
        <Link className="text-link" href="/conta/saques">
          Ver saques
        </Link>
      </div>

      {resource.status === "error" ? (
        <ResourceError error={resource.error} retry={resource.retry} />
      ) : resource.status !== "ready" ? (
        <ResourceLoading label="Carregando saldo da conta de venda" />
      ) : (
        <>
          <div className={styles.balanceGrid}>
            <BalanceBucket
              label="Disponível para saque"
              amountMinor={resource.data.availableAmountMinor}
              currency={resource.data.currency}
              field="availableAmountMinor"
              detail="Lotes já liberados da retenção, descontado o que está reservado em saques."
            />
            <BalanceBucket
              label="Reservado em saques pendentes"
              amountMinor={resource.data.reservedAmountMinor}
              currency={resource.data.currency}
              field="reservedAmountMinor"
              detail="Parte do saldo liberado já comprometida com um pedido de saque em andamento."
            />
            <BalanceBucket
              label="Em retenção"
              amountMinor={resource.data.heldAmountMinor}
              currency={resource.data.currency}
              field="heldAmountMinor"
              detail="Lotes em HELD ou FROZEN. Ainda não podem ser sacados; o porquê está logo abaixo."
            />
          </div>

          <div className={styles.provenance} role="status">
            <BadgeInfo aria-hidden="true" size={18} />
            <span>
              Leitura de <code>{BALANCE_CONTRACT}</code> em {resource.data.currency}
            </span>
            <Freshness asOf={resource.data.asOf} />
          </div>

          <Panel className={styles.holdPanel} as="section" aria-labelledby="sales-hold-title">
            <h3 id="sales-hold-title" className={styles.holdTitle}>
              <Lock aria-hidden="true" size={17} /> Por que um valor fica retido
            </h3>
            <p className={styles.holdIntro}>
              Uma venda liquidada entra em retenção e só migra para o saldo disponível quando todas as
              condições abaixo estiverem satisfeitas. Basta uma falhar para o valor continuar retido.
              A regra é avaliada no servidor, em <code>modules/finance/src/hold-policy.ts</code>.
            </p>
            <dl className={styles.holdList}>
              {holdGates.map((gate) => (
                <div className={styles.holdItem} key={gate.code}>
                  <dt>
                    {gate.title} <code>{gate.code}</code>
                  </dt>
                  <dd>{gate.detail}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.holdFootnote}>
              Esta tela não exibe contagem regressiva de liberação. Quando a API publicar a data
              elegível de cada lote, ela aparecerá como data e hora verificáveis, nunca como
              cronômetro.
            </p>
          </Panel>
        </>
      )}
    </section>
  );
}

function BalanceBucket({
  label,
  amountMinor,
  currency,
  field,
  detail,
}: {
  label: string;
  amountMinor: string;
  currency: string;
  field: string;
  detail: string;
}) {
  const formatted = formatMinorUnits(amountMinor, currency);
  return (
    <Panel as="article" className={styles.balanceCard}>
      <h3 className={styles.metricLabel}>{label}</h3>
      <strong className={styles.metricValue}>
        {formatted ?? "Valor fora do contrato"}
      </strong>
      <p className={styles.metricReason}>{detail}</p>
      <p className={styles.metricSource}>
        Campo <code>{field}</code>
      </p>
    </Panel>
  );
}

interface DailyBucket {
  day: string;
  label: string;
  count: number;
  grossMinor: string;
}

function buildDailyBuckets(rows: readonly SellerOrderListItem[]): DailyBucket[] {
  const byDay = new Map<string, { count: number; totals: string[] }>();
  for (const row of rows) {
    const day = row.placedAt.slice(0, 10);
    const bucket = byDay.get(day) ?? { count: 0, totals: [] };
    bucket.count += 1;
    bucket.totals.push(row.totalMinor);
    byDay.set(day, bucket);
  }

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return [...byDay.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([day, bucket]) => {
      const parsed = new Date(`${day}T12:00:00.000Z`);
      return {
        day,
        label: Number.isNaN(parsed.getTime()) ? day : formatter.format(parsed),
        count: bucket.count,
        grossMinor: sumMinorUnits(bucket.totals) ?? "0",
      };
    });
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const CHART_PAD_LEFT = 8;
const CHART_PAD_BOTTOM = 24;

function SalesChart({
  buckets,
  currency,
  asOf,
}: {
  buckets: readonly DailyBucket[];
  currency: string | null;
  asOf: string;
}) {
  const maxMinor = buckets.reduce((largest, bucket) => {
    const value = BigInt(bucket.grossMinor);
    return value > largest ? value : largest;
  }, 0n);

  const plotHeight = CHART_HEIGHT - CHART_PAD_BOTTOM;
  const slot = buckets.length > 0 ? (CHART_WIDTH - CHART_PAD_LEFT * 2) / buckets.length : 0;
  const barWidth = Math.min(38, Math.max(4, slot * 0.62));

  return (
    <div className={styles.chartFrame}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
        preserveAspectRatio="none"
        role="presentation"
        aria-hidden="true"
        focusable="false"
      >
        <line
          x1={CHART_PAD_LEFT}
          y1={plotHeight}
          x2={CHART_WIDTH - CHART_PAD_LEFT}
          y2={plotHeight}
          className={styles.chartAxis}
        />
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={CHART_PAD_LEFT}
            y1={plotHeight - plotHeight * ratio}
            x2={CHART_WIDTH - CHART_PAD_LEFT}
            y2={plotHeight - plotHeight * ratio}
            className={styles.chartGrid}
          />
        ))}
        {buckets.map((bucket, index) => {
          const value = BigInt(bucket.grossMinor);
          const height =
            maxMinor === 0n
              ? 0
              : Number((value * BigInt(Math.round(plotHeight * 1000))) / maxMinor) / 1000;
          const x = CHART_PAD_LEFT + slot * index + (slot - barWidth) / 2;
          return (
            <rect
              key={bucket.day}
              className={styles.chartBar}
              x={x}
              y={plotHeight - height}
              width={barWidth}
              height={Math.max(height, value > 0n ? 2 : 0)}
            />
          );
        })}
      </svg>
      <div className={styles.chartScale}>
        <span>
          Maior dia:{" "}
          {currency && maxMinor > 0n
            ? (formatMinorUnits(maxMinor.toString(), currency) ?? "valor fora do contrato")
            : "sem valor"}
        </span>
        <span>
          Corte da leitura: <time dateTime={asOf}>{asOf}</time>
        </span>
      </div>
    </div>
  );
}

function SalesChartSection({
  buckets,
  currency,
  asOf,
  ordersCount,
}: {
  buckets: readonly DailyBucket[];
  currency: string | null;
  asOf: string;
  ordersCount: number;
}) {
  return (
    <section className={styles.section} aria-labelledby="sales-chart-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="sales-chart-title">Bruto por dia</h2>
          <p>
            Série montada a partir dos {ordersCount}{" "}
            {ordersCount === 1 ? "pedido carregado" : "pedidos carregados"} nesta tela, agrupados pela
            data do pedido. Não é projeção do servidor.
          </p>
        </div>
      </div>

      <Panel className={styles.chartPanel}>
        <SalesChart buckets={buckets} currency={currency} asOf={asOf} />
        {buckets.length === 0 ? (
          <PageState
            kind="empty"
            title="Nenhum dia com pedido nesta leitura"
            description="A estrutura do gráfico fica visível para você reconhecer a tela, mas nenhuma curva foi desenhada. Sem pedido não existe série."
          />
        ) : null}
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className={styles.tableCaption}>
              Equivalente em tabela do gráfico acima: bruto e quantidade de pedidos por dia
            </caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col" className={styles.numericHead}>
                  Pedidos
                </th>
                <th scope="col" className={styles.numericHead}>
                  Bruto do dia
                </th>
              </tr>
            </thead>
            <tbody>
              {buckets.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.emptyRow}>
                    Nenhum pedido nesta leitura.
                  </td>
                </tr>
              ) : (
                buckets.map((bucket) => (
                  <tr key={bucket.day}>
                    <th scope="row">
                      <time dateTime={bucket.day}>{bucket.label}</time>
                    </th>
                    <td className={styles.numeric}>{bucket.count}</td>
                    <td className={styles.numeric}>
                      {currency
                        ? (formatMinorUnits(bucket.grossMinor, currency) ?? "Valor fora do contrato")
                        : "Moeda não informada"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}

function OrdersUnavailable({ error, retry }: { error: Error; retry: () => void }) {
  if (!isApiError(error)) return <ResourceError error={error} retry={retry} />;
  const { problem } = error;
  if (problem.status !== 404 && problem.code !== "CAPABILITY_NOT_IMPLEMENTED") {
    return <ResourceError error={error} retry={retry} />;
  }
  const description = `Esta tela consome ${SELLER_ORDERS_CONTRACT}. O backend não expôs essa leitura neste corte, então nenhum pedido, valor ou métrica de volume foi inventado para preencher o espaço.`;
  const actions = (
    <Button variant="outline" onClick={retry}>
      Tentar novamente
    </Button>
  );
  return problem.correlationId === undefined ? (
    <PageState
      kind="unavailable"
      title="Pedidos de venda ainda não publicados pela API"
      description={description}
      actions={actions}
    />
  ) : (
    <PageState
      kind="unavailable"
      title="Pedidos de venda ainda não publicados pela API"
      description={description}
      actions={actions}
      reference={problem.correlationId}
    />
  );
}

function unpublishedVolumeMetrics(): SalesMetric[] {
  return [
    {
      state: "NOT_PUBLISHED",
      code: "ORDERS_TOTAL",
      label: "Pedidos no período",
      contract: SELLER_ORDERS_CONTRACT,
      reason: "Sem a leitura de pedidos não existe contagem verificável para esta conta.",
    },
    {
      state: "NOT_PUBLISHED",
      code: "GROSS_TOTAL",
      label: "Bruto vendido",
      contract: SELLER_ORDERS_CONTRACT,
      reason: "O bruto só pode ser somado sobre pedidos reais devolvidos pela API.",
    },
    {
      state: "NOT_PUBLISHED",
      code: "CONVERSION_RATE",
      label: "Taxa de conversão",
      contract: "Contrato de métricas de vitrine ainda não definido em docs/07",
      reason:
        "Conversão exige visitas e pedidos medidos pela mesma fonte. Nenhuma das duas séries está publicada.",
    },
    {
      state: "NOT_PUBLISHED",
      code: "SELLER_RATING",
      label: "Reputação",
      contract: "Contrato de reputação do vendedor ainda não publicado",
      reason: "Nota e quantidade de avaliações só aparecem quando vierem assinadas pelo servidor.",
    },
  ];
}

function OrdersSection({ sellerAccountId }: { sellerAccountId: string }) {
  const resource = useApiResource<SellerOrderPage>(sellerOrdersPath(sellerAccountId, null));
  const [extraRows, setExtraRows] = useState<SellerOrderListItem[]>([]);
  const [extraDiscarded, setExtraDiscarded] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorInitialized, setCursorInitialized] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);

  const firstPage = resource.status === "ready" ? resource.data : null;
  const parsedFirst = useMemo(
    () => parseSellerOrderRows(firstPage?.data),
    [firstPage],
  );

  const activeCursor = cursorInitialized ? cursor : (firstPage?.nextCursor ?? null);

  const rows = useMemo(() => {
    const byId = new Map<string, SellerOrderListItem>();
    for (const row of [...parsedFirst.rows, ...extraRows]) byId.set(row.orderId, row);
    return [...byId.values()];
  }, [extraRows, parsedFirst.rows]);

  const buckets = useMemo(() => buildDailyBuckets(rows), [rows]);
  const currency = rows[0]?.currency ?? null;
  const discarded = parsedFirst.discarded + extraDiscarded;

  async function loadMore() {
    if (!activeCursor || loadingMore) return;
    setLoadingMore(true);
    setPaginationError(null);
    try {
      const nextPage = await apiRequest<SellerOrderPage>(
        sellerOrdersPath(sellerAccountId, activeCursor),
      );
      const parsed = parseSellerOrderRows(nextPage.data);
      setExtraRows((current) => [...current, ...parsed.rows]);
      setExtraDiscarded((current) => current + parsed.discarded);
      setCursor(nextPage.nextCursor ?? null);
      setCursorInitialized(true);
    } catch (error: unknown) {
      setPaginationError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a próxima página de pedidos.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  if (resource.status === "error") {
    return (
      <>
        <section className={styles.metricGrid} aria-label="Métricas de volume de vendas">
          {unpublishedVolumeMetrics().map((metric) => (
            <SalesMetricCard metric={metric} key={metric.code} />
          ))}
        </section>
        <OrdersUnavailable error={resource.error} retry={resource.retry} />
      </>
    );
  }

  if (resource.status !== "ready" || !firstPage) {
    return <ResourceLoading label="Carregando pedidos de venda" />;
  }

  const grossTotal = sumMinorUnits(rows.map((row) => row.totalMinor));
  const feeTotal = sumMinorUnits(rows.map((row) => row.feeMinor));

  const metrics: SalesMetric[] = [];
  if (rows.length > 0 && currency && grossTotal !== null) {
    metrics.push({
      state: "PUBLISHED",
      code: "GROSS_LOADED",
      label: "Bruto dos pedidos carregados",
      value: { kind: "MONEY", amountMinor: grossTotal, currency },
      source: {
        kind: "DERIVED_FROM_PAGE",
        endpoint: SELLER_ORDERS_CONTRACT,
        derivation: "Soma de totalMinor",
      },
      asOf: firstPage.asOf,
    });
  }
  if (rows.length > 0 && currency && feeTotal !== null) {
    metrics.push({
      state: "PUBLISHED",
      code: "FEE_LOADED",
      label: "Taxa da plataforma nos pedidos carregados",
      value: { kind: "MONEY", amountMinor: feeTotal, currency },
      source: {
        kind: "DERIVED_FROM_PAGE",
        endpoint: SELLER_ORDERS_CONTRACT,
        derivation: "Soma de feeMinor",
      },
      asOf: firstPage.asOf,
    });
  }
  metrics.push({
    state: "PUBLISHED",
    code: "ORDERS_LOADED",
    label: "Pedidos carregados nesta leitura",
    value: { kind: "COUNT", count: rows.length },
    source: {
      kind: "DERIVED_FROM_PAGE",
      endpoint: SELLER_ORDERS_CONTRACT,
      derivation: "Contagem de linhas válidas",
    },
    asOf: firstPage.asOf,
  });
  metrics.push({
    state: "NOT_PUBLISHED",
    code: "CONVERSION_RATE",
    label: "Taxa de conversão",
    contract: "Contrato de métricas de vitrine ainda não definido em docs/07",
    reason:
      "Conversão exige visitas e pedidos medidos pela mesma fonte. A série de visitas não está publicada.",
  });

  return (
    <>
      <section className={styles.metricGrid} aria-label="Métricas desta leitura">
        {metrics.map((metric) => (
          <SalesMetricCard metric={metric} key={metric.code} />
        ))}
      </section>

      {discarded > 0 ? (
        <p className={styles.contractWarning} role="status">
          <ShieldQuestion aria-hidden="true" size={17} />
          <span>
            {discarded} {discarded === 1 ? "registro foi descartado" : "registros foram descartados"}{" "}
            por não corresponder ao contrato de pedidos. Nenhum campo faltante foi preenchido por
            suposição.
          </span>
        </p>
      ) : null}

      <SalesChartSection
        buckets={buckets}
        currency={currency}
        asOf={firstPage.asOf}
        ordersCount={rows.length}
      />

      <section className={styles.section} aria-labelledby="sales-orders-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="sales-orders-title">Pedidos de venda</h2>
            <p>
              Somente pedidos desta conta de venda. A ordenação é aplicada às linhas já carregadas.
            </p>
          </div>
          <Link className="text-link" href="/vender/anuncios">
            <Boxes aria-hidden="true" size={15} /> Gerenciar anúncios
          </Link>
        </div>

        <Panel className={styles.tablePanel}>
          {rows.length === 0 ? (
            <PageState
              kind="empty"
              title="Nenhum pedido nesta conta de venda"
              description="A API respondeu sem pedidos para este escopo. Nenhuma venda de exemplo foi colocada no lugar."
              actions={
                <Link className="button-link" href="/vender/novo">
                  Criar um anúncio
                </Link>
              }
            />
          ) : (
            <SalesOrderTable
              rows={rows}
              caption="Pedidos de venda da conta selecionada, com bruto, taxa e líquido previsto"
            />
          )}
        </Panel>

        <div className={styles.pager}>
          <p>
            {rows.length} {rows.length === 1 ? "pedido carregado" : "pedidos carregados"} ·{" "}
            <code>{SELLER_ORDERS_CONTRACT}</code>
          </p>
          {paginationError ? (
            <p className={styles.errorText} role="alert">
              {paginationError}
            </p>
          ) : null}
          {activeCursor ? (
            <Button
              variant="outline"
              size="small"
              loading={loadingMore}
              loadingLabel="Carregando pedidos"
              onClick={() => {
                void loadMore();
              }}
            >
              Carregar mais pedidos
            </Button>
          ) : (
            <span className={styles.pagerDone}>Todos os pedidos retornados foram carregados.</span>
          )}
        </div>
      </section>
    </>
  );
}

function ScopedSalesDashboard() {
  const { selectedSeller } = useAccountContext();
  if (!selectedSeller) return null;

  return (
    <div className={styles.pageStack}>
      <ScopeStrip />
      <BalancePanel sellerAccountId={selectedSeller.sellerAccountId} />
      <OrdersSection
        sellerAccountId={selectedSeller.sellerAccountId}
        key={selectedSeller.sellerAccountId}
      />
    </div>
  );
}

export function SalesDashboard() {
  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="VENDEDOR · OPERAÇÃO"
        title="Painel de vendas"
        description="Saldo, retenção e pedidos da conta de venda selecionada. Cada número exibido declara de onde veio."
        action={
          <Link className="button-link" href="/vender/novo">
            Criar anúncio
          </Link>
        }
      />
      <SellerScopeGate>
        <ScopedSalesDashboard />
      </SellerScopeGate>
    </div>
  );
}

function CapabilityPreview({
  title,
  intro,
  contract,
  willDo,
  guardrails,
}: {
  title: string;
  intro: string;
  contract: string;
  willDo: readonly string[];
  guardrails: readonly string[];
}) {
  return (
    <div className={styles.pageStack}>
      <ScopeStrip />
      <Panel className={styles.previewPanel} as="section" aria-labelledby="capability-preview-title">
        <h2 id="capability-preview-title" className={styles.previewTitle}>
          <ScrollText aria-hidden="true" size={18} /> {title}
        </h2>
        <p className={styles.previewIntro}>{intro}</p>
        <div className={styles.previewGrid}>
          <div>
            <h3>O que esta tela vai fazer</h3>
            <ul>
              {willDo.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Limites que não mudam quando ela abrir</h3>
            <ul>
              {guardrails.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
      <PageState
        kind="unavailable"
        title="Capacidade ainda fechada"
        description={`A rota existe e o contrato está descrito acima, mas ${contract} não foi publicado. Nenhuma lista, coorte ou estimativa foi simulada para ocupar a tela.`}
        actions={
          <Link className="button-link" href="/conta/vendas">
            Voltar ao painel de vendas
          </Link>
        }
      />
    </div>
  );
}

export function SalesCustomersView() {
  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="VENDEDOR · CLIENTES"
        title="Clientes"
        description="Comportamento agregado de compra, sem entregar dado pessoal do comprador ao vendedor."
      />
      <SellerScopeGate>
        <CapabilityPreview
          title="Clientes — SCR-SEL-015"
          intro="A tela vai mostrar recompra, coorte e ciclo de vida do produto em forma agregada. O desenho parte de uma decisão que não é negociável: o vendedor opera sobre segmentos, não sobre uma lista de pessoas."
          contract="o grant customer_insights.read e a leitura SellerCustomerInsight"
          willDo={[
            "Segmentos de recompra e coortes por período, sempre com o corte de leitura visível.",
            "Ciclo de vida do produto vindo de ProductLifecyclePolicy, para saber quando faz sentido reabordar.",
            "Navegação do segmento para o pedido canônico, dentro do escopo desta conta de venda.",
            "Criação de audiência elegível que segue para a tela de marketing.",
          ]}
          guardrails={[
            "Telefone, e-mail e endereço do comprador não são exibidos nem exportados.",
            "Contato sem consentimento válido ou com supressão ativa fica fora de qualquer audiência.",
            "Contagem de clientes só aparece quando vier do servidor, com asOf.",
            "Nada aqui vira lista para planilha: o vendedor age por audiência, não por pessoa.",
          ]}
        />
      </SellerScopeGate>
    </div>
  );
}

export function SalesMarketingView() {
  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="VENDEDOR · MARKETING"
        title="Marketing"
        description="Campanhas sobre audiência elegível, com consentimento e supressão verificados pelo servidor."
      />
      <SellerScopeGate>
        <CapabilityPreview
          title="Marketing — SCR-SEL-016"
          intro="A tela vai montar campanha, jornada, cupom e criativo sobre audiências já validadas. Ativação congela a versão da campanha para que o que foi aprovado seja exatamente o que sai."
          contract="o contrato de Campaign, Journey, ConsentRecord e SuppressionEntry"
          willDo={[
            "Rascunho de campanha com versão congelada na ativação.",
            "Seleção de audiência elegível herdada da tela de clientes.",
            "Template e criativo com prévia antes do envio.",
            "Acompanhamento de entrega e atribuição por AttributionSnapshot.",
          ]}
          guardrails={[
            "Estimativa de alcance só aparece quando o servidor calcular — nunca um número ilustrativo.",
            "Escassez falsa, cronômetro decorativo e confirmshaming são proibidos no criativo (docs/03 §10).",
            "Consentimento nunca vem pré-marcado, e a supressão é aplicada antes do disparo.",
            "Canal precisa estar homologado; sem health do canal, a ativação fica bloqueada.",
          ]}
        />
      </SellerScopeGate>
    </div>
  );
}
