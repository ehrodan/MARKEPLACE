"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Freshness, PageState, Panel, Skeleton, StatusBadge } from "@midas/ui";
import { COPY } from "@/lib/copy-deck";
import { isApiError, type ApiError } from "@/lib/api-client";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatMinorAmount } from "@/components/operations/minor-money";
import styles from "./progression.module.css";

/**
 * /ranking — SCR-PUB-014.
 *
 * Contrato (docs/07-MAPA-DE-TELAS-E-FLUXOS.md linha 111): "Exibir temporada
 * corrente e encerradas com fórmula, moeda, posição, pontos, GMV elegível e
 * premiação verificáveis", a partir de `LeaderboardProjection`,
 * `LeaderboardSeason`, `LeaderboardAward`, `asOf` e policy version. Acesso
 * público com identidade mascarada conforme política.
 *
 * Estado real desta versão: a leitura `GET /v1/leaderboards/sellers`
 * (docs/13-PAGAMENTOS-REPUTACAO-PROGRESSAO.md seção 19.3) ainda não é servida
 * por `apps/api`. A tela consulta o contrato canônico mesmo assim — quando a
 * capability subir, a classificação aparece sem nova entrega — e enquanto a
 * resposta for 404/501 mostra estado honesto, sem linha, nome ou ponto
 * inventado.
 *
 * O que a tela entrega hoje sem projeção publicada, tudo derivado da policy do
 * domínio (`modules/progression/src/leaderboard-policy.ts`): fórmula literal,
 * moeda, unidade de pontuação, ordem de desempate e critério de elegibilidade.
 *
 * Identidade: a projeção publica apenas o rótulo já mascarado. O tipo
 * `LeaderboardRow` abaixo não declara — e a tela não lê — nenhum campo de
 * identidade real (id de conta, nome legal, e-mail, documento).
 *
 * Perfil de motion M1: skeleton de carregamento e expansão de `<details>`.
 */

/**
 * Espelho literal de `modules/progression/src/leaderboard-policy.ts` →
 * `INITIAL_LEADERBOARD_POLICY`. Travado por
 * `components/progression/level-ladder.test.tsx`, que importa a policy real e
 * confere versão, moeda e as duas constantes da fórmula.
 */
export const LEADERBOARD_POLICY_VERSION = "leaderboard-brl.v1";
export const LEADERBOARD_CURRENCY = "BRL";
export const BASE_MINOR_PER_POINT = 1_000;
export const PREMIUM_BONUS_HALF_POINTS_PER_WHOLE_BRL = 1;

export const LEADERBOARD_ENDPOINT = "/v1/leaderboards/sellers";

export interface LeaderboardHalfPoints {
  readonly baseHalfPoints: number;
  readonly premiumBonusHalfPoints: number;
  readonly totalHalfPoints: number;
}

/**
 * Mesma aritmética inteira de `calculateLeaderboardScore`: meio ponto é
 * representado por meio-pontos inteiros, sem ponto flutuante em valor
 * monetário nem em pontuação.
 */
export function leaderboardHalfPoints(
  eligibleGmvMinor: number,
  eligiblePremiumGmvMinor: number,
): LeaderboardHalfPoints {
  const baseHalfPoints = Math.floor(eligibleGmvMinor / BASE_MINOR_PER_POINT) * 2;
  const premiumBonusHalfPoints = Math.floor(eligiblePremiumGmvMinor / 100)
    * PREMIUM_BONUS_HALF_POINTS_PER_WHOLE_BRL;
  return {
    baseHalfPoints,
    premiumBonusHalfPoints,
    totalHalfPoints: baseHalfPoints + premiumBonusHalfPoints,
  };
}

/** Mesma apresentação de `formatHalfPoints` no domínio: "10" ou "10,5". */
export function formatPoints(halfPoints: number): string {
  const whole = Math.floor(halfPoints / 2);
  return halfPoints % 2 === 0 ? String(whole) : `${String(whole)},5`;
}

export const LEADERBOARD_FORMULA = [
  `baseHalfPoints         = 2 × floor(eligibleGmvMinor ÷ ${String(BASE_MINOR_PER_POINT)})`,
  `premiumBonusHalfPoints = ${String(PREMIUM_BONUS_HALF_POINTS_PER_WHOLE_BRL)} × floor(eligiblePremiumGmvMinor ÷ 100)`,
  "totalHalfPoints        = baseHalfPoints + premiumBonusHalfPoints",
  "pontos exibidos        = totalHalfPoints ÷ 2",
].join("\n");

/** Ordem versionada de desempate (docs/13 seção 14.4). */
export const TIEBREAK_ORDER: readonly string[] = Object.freeze([
  "Maior total de pontos apurado pela fórmula da temporada.",
  "Maior GMV elegível no período.",
  "Menor valor de reembolsos e chargebacks no período.",
  "Instante mais antigo em que a pontuação final foi atingida.",
  "Chave determinística opaca, publicada junto do fechamento.",
]);

export const UNPUBLISHED_AWARD_LABEL = "Premiação ainda não publicada";

/* ---------- Contrato de leitura ---------- */

export interface LeaderboardSeasonRef {
  readonly seasonId: string;
  readonly month: string;
  readonly status: "OPEN" | "PRELIMINARY" | "FINAL";
  readonly timezone?: string;
  readonly currency?: string;
  readonly formulaVersion?: string;
  readonly opensAt?: string;
  readonly closesAt?: string;
}

export interface LeaderboardRow {
  readonly rank: number;
  /** Rótulo já mascarado pela projeção. Nenhuma identidade real trafega aqui. */
  readonly maskedLabel: string;
  readonly totalHalfPoints: number;
  readonly eligibleGmvMinor: string;
  readonly eligiblePremiumGmvMinor: string;
  readonly awardLabel?: string | null;
}

export interface LeaderboardResponse {
  readonly data: readonly LeaderboardRow[];
  readonly season?: LeaderboardSeasonRef;
  readonly seasons?: readonly LeaderboardSeasonRef[];
  readonly asOf: string;
  readonly freshness?: "READY" | "STALE";
}

const seasonStatusLabels: Readonly<Record<LeaderboardSeasonRef["status"], string>> = {
  OPEN: "Temporada aberta",
  PRELIMINARY: "Snapshot provisório",
  FINAL: "Snapshot final",
};

function seasonLabel(season: LeaderboardSeasonRef): string {
  return `${season.month} · ${seasonStatusLabels[season.status]}`;
}

/* ---------- Estados honestos da classificação ---------- */

function LeaderboardLoading() {
  return (
    <div className={styles.loadingBlock} aria-busy="true" aria-label="Carregando classificação">
      <Skeleton height="3rem" />
      <Skeleton height="14rem" />
    </div>
  );
}

function LeaderboardUnavailable({
  error,
  retry,
}: {
  error: Error | ApiError;
  retry: () => void;
}) {
  if (!isApiError(error)) {
    return (
      <PageState
        kind="offline"
        title="Não foi possível alcançar a API"
        description="A conexão falhou. Nenhuma posição foi presumida nem substituída por valor demonstrativo."
        actions={<Button onClick={retry}>Tentar novamente</Button>}
      />
    );
  }

  const { problem } = error;
  const notPublished = problem.status === 404
    || problem.status === 501
    || problem.code === "CAPABILITY_NOT_IMPLEMENTED";

  if (notPublished) {
    return (
      <PageState
        kind="unavailable"
        title="Classificação ainda não publicada pela API"
        description={`A tela está pronta para o contrato canônico GET ${LEADERBOARD_ENDPOINT}, que devolve LeaderboardProjection, LeaderboardSeason e LeaderboardAward. Enquanto essa leitura não é servida, nenhuma posição, nenhum ponto e nenhum vendedor são exibidos. A fórmula, a moeda e o desempate acima continuam válidos e verificáveis.`}
        reference={problem.correlationId ?? `SCR-PUB-014 · GET ${LEADERBOARD_ENDPOINT}`}
      />
    );
  }

  if (problem.status === 503) {
    return (
      <PageState
        kind="unavailable"
        title="Consulta temporariamente indisponível"
        description={problem.detail ?? "A projeção do ranking não pôde ser lida agora. Nenhum dado antigo foi apresentado como atual."}
        actions={<Button onClick={retry}>Tentar novamente</Button>}
        reference={problem.correlationId ?? `GET ${LEADERBOARD_ENDPOINT}`}
      />
    );
  }

  return (
    <PageState
      kind="error"
      title={problem.title || "Não foi possível carregar a classificação"}
      description={problem.detail ?? "Tente novamente. Se o problema continuar, informe a referência abaixo ao suporte."}
      actions={<Button onClick={retry}>Tentar novamente</Button>}
      reference={problem.correlationId ?? `GET ${LEADERBOARD_ENDPOINT}`}
    />
  );
}

function LeaderboardTable({ page }: { page: LeaderboardResponse }) {
  const season = page.season;
  const currency = season?.currency ?? LEADERBOARD_CURRENCY;
  const provisional = season?.status !== "FINAL";

  return (
    <div className={styles.tableWrap}>
      <table className={styles.dataTable}>
        <caption>
          {season ? `Temporada ${seasonLabel(season)}.` : "Temporada corrente."}{" "}
          {provisional
            ? "Snapshot provisório: as posições ainda podem mudar até o fechamento e a conciliação."
            : "Snapshot final: posições, contribuições e desempate congelados."}{" "}
          Identidade mascarada conforme a política pública da temporada.
        </caption>
        <thead>
          <tr>
            <th scope="col">Posição</th>
            <th scope="col">Vendedor</th>
            <th scope="col">Pontos</th>
            <th scope="col">GMV elegível</th>
            <th scope="col">GMV Premium elegível</th>
            <th scope="col">Premiação</th>
          </tr>
        </thead>
        <tbody>
          {page.data.map((row) => (
            <tr key={`${String(row.rank)}-${row.maskedLabel}`}>
              <th scope="row">{row.rank}</th>
              <td>{row.maskedLabel}</td>
              <td className={`${styles.numeric} ${styles.emphasisCell}`}>
                {formatPoints(row.totalHalfPoints)}
              </td>
              <td className={styles.numeric}>{formatMinorAmount(row.eligibleGmvMinor, currency)}</td>
              <td className={styles.numeric}>
                {formatMinorAmount(row.eligiblePremiumGmvMinor, currency)}
              </td>
              <td>{row.awardLabel ?? UNPUBLISHED_AWARD_LABEL}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Tela ---------- */

export function LeaderboardView() {
  const [month, setMonth] = useState("");
  const path = month
    ? `${LEADERBOARD_ENDPOINT}?month=${encodeURIComponent(month)}`
    : LEADERBOARD_ENDPOINT;
  const resource = useApiResource<LeaderboardResponse>(path);

  const page = resource.status === "ready" ? resource.data : null;
  const seasons = page?.seasons ?? [];
  const example = {
    standard: leaderboardHalfPoints(10_000, 0),
    premium: leaderboardHalfPoints(10_000, 10_000),
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="ranking-titulo">
        <div>
          <span className={styles.heroKicker}>{COPY.ranking.header.kicker}</span>
          <h1 id="ranking-titulo">{COPY.ranking.header.headline}</h1>
        </div>
        <p className={styles.heroLede}>
          <strong>{COPY.ranking.header.subhead}</strong>
          {COPY.ranking.header.body}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="temporada">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>{COPY.ranking.season.kicker}</span>
          <h2 id="temporada">{COPY.ranking.season.headline}</h2>
          <p className={styles.lede}>{COPY.ranking.season.subhead} {COPY.ranking.season.body}</p>
        </header>

        <div className={styles.cardGrid}>
          <Panel className={styles.specCard}>
            <h3>Unidade e moeda</h3>
            <span className={styles.specValue}>{LEADERBOARD_CURRENCY}</span>
            <p>
              O sujeito da classificação é a conta de vendedor, não a pessoa. A moeda da
              temporada é congelada na abertura junto da fórmula.
            </p>
          </Panel>
          <Panel className={styles.specCard}>
            <h3>Unidade de pontuação</h3>
            <span className={styles.specValue}>
              1 ponto = {formatMinorAmount(BASE_MINOR_PER_POINT, LEADERBOARD_CURRENCY)}
            </span>
            <p>
              A base é um ponto a cada {formatMinorAmount(BASE_MINOR_PER_POINT, LEADERBOARD_CURRENCY)}{" "}
              de GMV elegível. O bônus Premium soma meio ponto por real elegível vendido em plano
              Premium.
            </p>
          </Panel>
          <Panel className={styles.specCard}>
            <h3>Janela da temporada</h3>
            <span className={styles.specValue}>Mês calendário</span>
            <p>
              Início, fim e fuso ficam registrados na temporada publicada. Nenhuma temporada foi
              publicada nesta versão, então esta tela não exibe data de abertura ou fechamento.
            </p>
          </Panel>
        </div>

        <pre className={styles.formula} aria-label="Fórmula de pontuação da temporada">
          {LEADERBOARD_FORMULA}
        </pre>

        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <caption>
              Exemplo aritmético da fórmula, calculado nesta página a partir da política{" "}
              <code>{LEADERBOARD_POLICY_VERSION}</code>. Não é venda, vendedor nem posição real:
              é a mesma conta aplicada a um valor escolhido para leitura.
            </caption>
            <thead>
              <tr>
                <th scope="col">Venda elegível</th>
                <th scope="col">Base</th>
                <th scope="col">Bônus Premium</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  {formatMinorAmount(10_000, LEADERBOARD_CURRENCY)} em plano Básico ou VIP
                </th>
                <td className={styles.numeric}>{formatPoints(example.standard.baseHalfPoints)}</td>
                <td className={styles.numeric}>
                  {formatPoints(example.standard.premiumBonusHalfPoints)}
                </td>
                <td className={`${styles.numeric} ${styles.emphasisCell}`}>
                  {formatPoints(example.standard.totalHalfPoints)} pontos
                </td>
              </tr>
              <tr>
                <th scope="row">
                  {formatMinorAmount(10_000, LEADERBOARD_CURRENCY)} em plano Premium
                </th>
                <td className={styles.numeric}>{formatPoints(example.premium.baseHalfPoints)}</td>
                <td className={styles.numeric}>
                  {formatPoints(example.premium.premiumBonusHalfPoints)}
                </td>
                <td className={`${styles.numeric} ${styles.emphasisCell}`}>
                  {formatPoints(example.premium.totalHalfPoints)} pontos
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className={styles.notice}>
          <strong>Consequência declarada:</strong> a diferença entre as duas linhas vem inteira da
          fórmula publicada, não de um impulso editorial. Alterar o multiplicador exige publicar
          nova versão da política antes da abertura da temporada.
        </p>

        <p className={styles.sourceNote}>
          Política <code>{LEADERBOARD_POLICY_VERSION}</code>, moeda <code>{LEADERBOARD_CURRENCY}</code>.
          Origem no domínio: <code>modules/progression/src/leaderboard-policy.ts</code>.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="elegibilidade">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>ELEGIBILIDADE E DESEMPATE</span>
          <h2 id="elegibilidade">O que conta, o que sai e como se desempata.</h2>
        </header>

        <div className={styles.cardGrid}>
          <Panel className={styles.specCard}>
            <h3>Base elegível</h3>
            <p>
              GMV bruto de pedidos concluídos e liquidados no período, líquido de reembolsos e
              chargebacks. Durante o mês existe snapshot preliminar; o snapshot final sai depois
              da janela de conciliação, e só ele vale para premiação.
            </p>
          </Panel>
          <Panel className={styles.specCard}>
            <h3>Fora do cálculo</h3>
            <ul className={styles.plainList}>
              <li>Compra do próprio vendedor e contas relacionadas.</li>
              <li>Vendas circulares e wash trading.</li>
              <li>Reembolso, chargeback e fraude comprovada.</li>
              <li>Pedidos ainda em retenção no período.</li>
            </ul>
          </Panel>
          <Panel className={styles.specCard}>
            <h3>Contestação</h3>
            <p>
              Contribuição sob investigação não é somada em silêncio nem apagada por edição
              direta: fica congelada com motivo registrado e direito a recurso.
            </p>
          </Panel>
        </div>

        <details className={styles.rule}>
          <summary>Abrir a ordem de desempate</summary>
          <div className={styles.ruleList}>
            <ol className={styles.orderedRules}>
              {TIEBREAK_ORDER.map((rule) => <li key={rule}>{rule}</li>)}
            </ol>
          </div>
        </details>
      </section>

      <section className={styles.section} aria-labelledby="classificacao">
        <header className={styles.resultsHeader}>
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>CLASSIFICAÇÃO</span>
            <h2 id="classificacao">Posições da temporada.</h2>
          </div>
          <div className={styles.resultsMeta}>
            {page?.season ? (
              <StatusBadge tone={page.season.status === "FINAL" ? "success" : "info"}>
                {seasonStatusLabels[page.season.status]}
              </StatusBadge>
            ) : null}
            {page ? <Freshness asOf={page.asOf} state={page.freshness ?? "READY"} /> : null}
          </div>
        </header>

        <div className={styles.filters}>
          <div className={styles.field}>
            <label htmlFor="ranking-temporada">Temporada</label>
            <select
              id="ranking-temporada"
              value={month}
              disabled={seasons.length === 0}
              aria-describedby="ranking-temporada-hint"
              onChange={(event) => { setMonth(event.target.value); }}
            >
              {seasons.length === 0 ? (
                <option value="">Nenhuma temporada publicada</option>
              ) : (
                <>
                  <option value="">Temporada corrente</option>
                  {seasons.map((season) => (
                    <option value={season.month} key={season.seasonId}>
                      {seasonLabel(season)}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
          <p className={styles.fieldHint} id="ranking-temporada-hint">
            A lista de temporadas vem de <code>LeaderboardSeason</code>. Enquanto nenhuma
            temporada estiver publicada, o seletor permanece desabilitado em vez de oferecer um
            período que não existe.
          </p>
        </div>

        <div aria-live="polite">
          {resource.status === "error" ? (
            <LeaderboardUnavailable error={resource.error} retry={resource.retry} />
          ) : page ? (
            page.data.length > 0 ? (
              <LeaderboardTable page={page} />
            ) : (
              <PageState
                kind="empty"
                title="Nenhuma posição apurada nesta temporada"
                description="A temporada existe, mas ainda não recebeu contribuição elegível. Nenhuma linha é preenchida para dar impressão de movimento."
                reference={`SCR-PUB-014 · GET ${LEADERBOARD_ENDPOINT}`}
              />
            )
          ) : (
            <LeaderboardLoading />
          )}
        </div>

        <p className={styles.sourceNote}>{COPY.ranking.season.microcopy}</p>
      </section>

      <section className={styles.section} aria-labelledby="premiacao-top3">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>PREMIAÇÃO</span>
          <h2 id="premiacao-top3">{UNPUBLISHED_AWARD_LABEL}.</h2>
          <p className={styles.lede}>
            O prêmio de primeiro, segundo e terceiro lugar é configurado com termos e vigência
            antes do fechamento da temporada. Enquanto isso não é publicado, esta tela não
            anuncia valor, item nem forma de entrega.
          </p>
        </header>

        <PageState
          kind="empty"
          title="Nenhuma premiação de temporada publicada"
          description="Nenhum LeaderboardAward vigente foi encontrado. Após o snapshot final, os ganhadores e as regras aparecem aqui sem expor identidade real, e a correção de qualquer erro gera nova versão auditada em vez de edição do histórico."
          reference="SCR-PUB-014 · LeaderboardAward"
        />

        <div className={styles.linkRow}>
          <Link className="button-link" href="/recompensas">Ver níveis e recompensas</Link>
          <Link className="text-link" href="/market">Explorar o marketplace</Link>
        </div>
      </section>
    </div>
  );
}
