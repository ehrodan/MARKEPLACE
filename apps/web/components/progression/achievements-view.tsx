"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { Freshness, PageState, Panel, Skeleton, StatusBadge } from "@midas/ui";
import { COPY } from "@/lib/copy-deck";
import { isApiError, type ApiError } from "@/lib/api-client";
import { useApiResource } from "@/hooks/use-api-resource";
import { useAccountContext } from "@/components/account/account-context";
import { SellerScopeGate } from "@/components/account/seller-scope-gate";
import { PageHeader } from "@/components/page-header";
import { ResourceError } from "@/components/resource-state";
import { formatMinorAmount } from "@/components/operations/minor-money";
import {
  ACCOUNT_LEVEL_CURRENCY,
  ACCOUNT_LEVEL_LADDER,
  ACCOUNT_LEVEL_POLICY_VERSION,
  levelCriterion,
} from "./level-ladder";
import { PREMIUM_BADGE_CODE } from "./rewards-view";
import styles from "./progression.module.css";

/**
 * /conta/conquistas — SCR-ACC-016.
 *
 * Contrato (docs/07-MAPA-DE-TELAS-E-FLUXOS.md linha 133): "Mostrar nível,
 * progresso, insígnias e recompensas concedidas com regra e origem", a partir
 * de `AccountLevelAssignment`, contribuições, `BadgeAward`, `RewardAward` e
 * freshness, no contexto pessoal com SellerAccount selecionado.
 *
 * Estado real desta versão: a leitura canônica
 * `GET /v1/seller-accounts/{sellerAccountId}/progression`
 * (docs/13-PAGAMENTOS-REPUTACAO-PROGRESSAO.md seção 19.3) ainda não é servida
 * por `apps/api` (`apps/api/src/app.ts` registra apenas finance, catalog,
 * retention e orders). A tela consulta o contrato canônico mesmo assim —
 * quando a capability subir, nível, insígnias e premiações aparecem sem nova
 * entrega — e, enquanto a resposta for 404/501, mostra estado indisponível
 * fail-closed citando o contrato ausente. RF-241/RF-243: slot vazio nunca é
 * preenchido com insígnia inventada; nenhum nível, award ou progresso é
 * simulado.
 *
 * O que a tela entrega hoje sem a leitura publicada: o contrato declarado de
 * cada leitura (com origem no domínio `modules/progression/src/`) e os
 * caminhos públicos reais — /recompensas (níveis 1–10, critérios, a única
 * `BadgeDefinition` publicada) e /ranking (fórmula e temporada).
 *
 * Escopo: o nível vem do histórico vendido qualificado da SellerAccount
 * selecionada (`AccountLevelAssignment` é por seller, docs/13 seção 17);
 * `BadgeAward`/`RewardAward` registram o beneficiário conforme a regra da
 * definição. Sem SellerAccount, o gate declara a ausência de contexto em vez
 * de exibir progresso vazio como se fosse dado.
 *
 * Perfil de motion M1: skeleton de carregamento e nada além disso.
 */

export const PROGRESSION_ENDPOINT_TEMPLATE =
  "/v1/seller-accounts/{sellerAccountId}/progression";

export function progressionEndpoint(sellerAccountId: string): string {
  return `/v1/seller-accounts/${encodeURIComponent(sellerAccountId)}/progression`;
}

/* ---------- Contrato de leitura (docs/13 seções 17 e 19.3) ---------- */

export interface ProgressionLevelAssignment {
  readonly policyVersion: string;
  readonly currency: string;
  /** Minor units inteiras; string preserva precisão como nas demais leituras. */
  readonly qualifiedLifetimeGmvMinor: string | number;
  readonly level: string;
  readonly nextLevelMinInclusiveMinor?: string | number | null;
  readonly contributionChecksum?: string;
}

export interface BadgeAwardEntry {
  readonly badgeCode: string;
  readonly definitionVersion: string;
  readonly status: "ACTIVE" | "REVOKED";
  readonly awardedAt: string;
  readonly sourceEventId?: string | null;
  readonly revokedReason?: string | null;
}

export interface RewardAwardEntry {
  readonly rewardCode: string;
  readonly definitionVersion: string;
  readonly status: "GRANTED" | "FULFILLED" | "REVOKED";
  readonly awardedAt: string;
  readonly fulfilledAt?: string | null;
}

export interface AccountProgressionResponse {
  readonly levelAssignment: ProgressionLevelAssignment;
  readonly badgeAwards: readonly BadgeAwardEntry[];
  readonly rewardAwards: readonly RewardAwardEntry[];
  readonly asOf: string;
  readonly freshness?: "READY" | "STALE";
}

/* ---------- Apresentação ---------- */

const badgeStatusLabels: Readonly<Record<string, string>> = {
  ACTIVE: "Ativa",
  REVOKED: "Revogada",
};

const rewardStatusLabels: Readonly<Record<string, string>> = {
  GRANTED: "Concedida",
  FULFILLED: "Entregue",
  REVOKED: "Revogada",
};

function badgeTone(status: string): "success" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "REVOKED") return "danger";
  return "neutral";
}

function rewardTone(status: string): "success" | "danger" | "info" | "neutral" {
  if (status === "FULFILLED") return "success";
  if (status === "REVOKED") return "danger";
  if (status === "GRANTED") return "info";
  return "neutral";
}

/** Estado desconhecido aparece literal, nunca traduzido para algo mais bonito. */
function statusLabel(labels: Readonly<Record<string, string>>, status: string): string {
  return labels[status] ?? status;
}

function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

/* ---------- Estados honestos ---------- */

function AchievementsLoading() {
  return (
    <div className={styles.loadingBlock} aria-busy="true" aria-label="Carregando progressão da conta">
      <Skeleton height="3rem" />
      <Skeleton height="10rem" />
      <Skeleton height="10rem" />
    </div>
  );
}

function AchievementsUnavailable({
  error,
  retry,
}: {
  error: Error | ApiError;
  retry: () => void;
}) {
  if (isApiError(error)) {
    const { problem } = error;
    const notPublished = problem.status === 404
      || problem.status === 501
      || problem.code === "CAPABILITY_NOT_IMPLEMENTED";
    if (notPublished) {
      return (
        <PageState
          kind="unavailable"
          title="Progressão da conta ainda não publicada pela API"
          description={`A tela está pronta para o contrato canônico GET ${PROGRESSION_ENDPOINT_TEMPLATE}, que devolve AccountLevelAssignment, BadgeAward, RewardAward e freshness. Enquanto essa leitura não é servida, nenhum nível, insígnia ou premiação é exibido ou simulado. As regras públicas continuam verificáveis em Níveis e recompensas e no Ranking.`}
          reference={problem.correlationId ?? `SCR-ACC-016 · GET ${PROGRESSION_ENDPOINT_TEMPLATE}`}
        />
      );
    }
  }
  return <ResourceError error={error} retry={retry} />;
}

/* ---------- Leitura publicada ---------- */

function LevelPanels({ assignment }: { assignment: ProgressionLevelAssignment }) {
  const currency = assignment.currency || ACCOUNT_LEVEL_CURRENCY;
  // O espelho local só é usado quando a versão da política confere; com versão
  // divergente a tela mostra apenas o que a API devolveu, sem misturar regras.
  const mirrored = assignment.policyVersion === ACCOUNT_LEVEL_POLICY_VERSION
    ? ACCOUNT_LEVEL_LADDER.find((entry) => entry.level === assignment.level)
    : undefined;

  return (
    <div className={styles.cardGrid}>
      <Panel className={styles.specCard} as="article">
        <h3>Nível da conta</h3>
        <span className={styles.specValue}>
          {mirrored ? `Nível ${String(mirrored.ordinal)}` : assignment.level}{" "}
          <code className={styles.ladderCode}>{assignment.level}</code>
        </span>
        <p>
          {mirrored
            ? `Critério da faixa: ${levelCriterion(mirrored)} em valor vendido qualificado (${currency}).`
            : `Faixa publicada pela política ${assignment.policyVersion}; o critério detalhado vem da própria política.`}
        </p>
      </Panel>
      <Panel className={styles.specCard} as="article">
        <h3>Valor vendido qualificado</h3>
        <span className={styles.specValue}>
          {formatMinorAmount(assignment.qualifiedLifetimeGmvMinor, currency)}
        </span>
        <p>
          Soma de pedidos concluídos e liquidados, menos refunds e chargebacks canônicos —
          recalculada por contribuição registrada, nunca por contador editado à mão.
        </p>
      </Panel>
      <Panel className={styles.specCard} as="article">
        <h3>Próxima faixa</h3>
        {assignment.nextLevelMinInclusiveMinor === null
          || assignment.nextLevelMinInclusiveMinor === undefined ? (
          <>
            <span className={styles.specValue}>Faixa final</span>
            <p>Não existe nível acima na política vigente.</p>
          </>
        ) : (
          <>
            <span className={styles.specValue}>
              A partir de {formatMinorAmount(assignment.nextLevelMinInclusiveMinor, currency)}
            </span>
            <p>O nível muda pelo recálculo das contribuições quando o valor qualificado cruza a faixa publicada.</p>
          </>
        )}
      </Panel>
    </div>
  );
}

function BadgeAwardsSection({ badges }: { badges: readonly BadgeAwardEntry[] }) {
  return (
    <section className={styles.section} aria-labelledby="insignias-concedidas">
      <header className={styles.sectionHead}>
        <span className={styles.eyebrow}>INSÍGNIAS</span>
        <h3 id="insignias-concedidas">Insígnias concedidas</h3>
      </header>
      {badges.length === 0 ? (
        <PageState
          kind="empty"
          title="Nenhuma insígnia concedida a esta conta"
          description="Nenhum BadgeAward consta para a conta selecionada. O slot permanece declarado e vazio — nenhuma insígnia é inventada para preencher espaço."
          reference="SCR-ACC-016 · BadgeAward"
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <caption>
              Concessões registradas com definição versionada e evento de origem.
              Revogação aparece com motivo, nunca por remoção silenciosa.
            </caption>
            <thead>
              <tr>
                <th scope="col">Insígnia</th>
                <th scope="col">Definição</th>
                <th scope="col">Estado</th>
                <th scope="col">Concedida em</th>
                <th scope="col">Origem</th>
              </tr>
            </thead>
            <tbody>
              {badges.map((badge) => (
                <tr key={`${badge.badgeCode}-${badge.definitionVersion}-${badge.awardedAt}`}>
                  <th scope="row"><code>{badge.badgeCode}</code></th>
                  <td><code>{badge.definitionVersion}</code></td>
                  <td>
                    <StatusBadge tone={badgeTone(badge.status)}>
                      {statusLabel(badgeStatusLabels, badge.status)}
                    </StatusBadge>
                    {badge.revokedReason ? <> — {badge.revokedReason}</> : null}
                  </td>
                  <td className={styles.numeric}>{formatInstant(badge.awardedAt)}</td>
                  <td>
                    {badge.sourceEventId
                      ? <code>{badge.sourceEventId}</code>
                      : "Evento de origem não informado pela leitura."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RewardAwardsSection({ rewards }: { rewards: readonly RewardAwardEntry[] }) {
  return (
    <section className={styles.section} aria-labelledby="premiacoes-concedidas">
      <header className={styles.sectionHead}>
        <span className={styles.eyebrow}>PREMIAÇÕES</span>
        <h3 id="premiacoes-concedidas">Premiações concedidas</h3>
      </header>
      {rewards.length === 0 ? (
        <PageState
          kind="empty"
          title="Nenhuma premiação concedida a esta conta"
          description="Nenhum RewardAward consta para a conta selecionada. Esta tela não antecipa prêmio, cupom, benefício ou valor que ainda não foi concedido."
          reference="SCR-ACC-016 · RewardAward"
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <caption>
              Concessões com definição versionada e fulfillment registrado com prova e executor.
            </caption>
            <thead>
              <tr>
                <th scope="col">Premiação</th>
                <th scope="col">Definição</th>
                <th scope="col">Estado</th>
                <th scope="col">Concedida em</th>
                <th scope="col">Entrega</th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((reward) => (
                <tr key={`${reward.rewardCode}-${reward.definitionVersion}-${reward.awardedAt}`}>
                  <th scope="row"><code>{reward.rewardCode}</code></th>
                  <td><code>{reward.definitionVersion}</code></td>
                  <td>
                    <StatusBadge tone={rewardTone(reward.status)}>
                      {statusLabel(rewardStatusLabels, reward.status)}
                    </StatusBadge>
                  </td>
                  <td className={styles.numeric}>{formatInstant(reward.awardedAt)}</td>
                  <td className={styles.numeric}>
                    {reward.fulfilledAt
                      ? formatInstant(reward.fulfilledAt)
                      : "Entrega ainda não registrada."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AchievementsData({
  page,
  scopeLabel,
}: {
  page: AccountProgressionResponse;
  scopeLabel: string;
}) {
  const assignment = page.levelAssignment;
  return (
    <div className={styles.accountStack}>
      <div className={styles.resultsMeta}>
        <StatusBadge tone="info">Leitura canônica</StatusBadge>
        <Freshness asOf={page.asOf} state={page.freshness ?? "READY"} />
      </div>
      <LevelPanels assignment={assignment} />
      <p className={styles.sourceNote}>
        Política <code>{assignment.policyVersion}</code>
        {assignment.contributionChecksum
          ? <> · checksum de contribuições <code>{assignment.contributionChecksum}</code></>
          : null}
        {" "}· escopo {scopeLabel} · origem <code>GET {PROGRESSION_ENDPOINT_TEMPLATE}</code>.
      </p>
      <BadgeAwardsSection badges={page.badgeAwards} />
      <RewardAwardsSection rewards={page.rewardAwards} />
    </div>
  );
}

/* ---------- Progressão da SellerAccount selecionada ---------- */

function ScopedAchievements() {
  const { selectedSeller } = useAccountContext();
  const endpoint = selectedSeller
    ? progressionEndpoint(selectedSeller.sellerAccountId)
    : null;
  const resource = useApiResource<AccountProgressionResponse>(endpoint);

  return (
    <div aria-live="polite">
      {resource.status === "error" ? (
        <AchievementsUnavailable error={resource.error} retry={resource.retry} />
      ) : resource.status === "ready" ? (
        <AchievementsData
          page={resource.data}
          scopeLabel={selectedSeller?.displayName ?? "conta selecionada"}
        />
      ) : (
        <AchievementsLoading />
      )}
    </div>
  );
}

/* ---------- Tela ---------- */

export function AchievementsView() {
  return (
    <div className={styles.accountPage}>
      <PageHeader
        eyebrow="CONTA · PROGRESSÃO"
        title="Conquistas"
        description="Nível, insígnias e premiações concedidas à conta, sempre com regra, versão e origem — e estado declarado quando a leitura ainda não existe."
        meta={<span><Trophy aria-hidden="true" size={15} /> Progressão por contribuição registrada</span>}
      />

      <section className={styles.section} aria-labelledby="conquistas-contrato">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>O QUE ESTA TELA MOSTRA</span>
          <h2 id="conquistas-contrato">Três leituras, todas com origem.</h2>
          <p className={styles.lede}>
            Tudo aqui deriva de registro versionado do domínio de progressão — nunca de contador
            editado ou de espaço preenchido para dar impressão de movimento.
          </p>
        </header>
        <div className={styles.cardGrid}>
          <Panel className={styles.specCard} as="article">
            <h3>Nível e progresso</h3>
            <p>
              <code className={styles.inlineCode}>AccountLevelAssignment</code>: a faixa vigente
              (L1–L10) e o valor vendido qualificado da SellerAccount, recalculados por
              contribuição registrada. Refund posterior pode reduzir o nível corrente.
            </p>
            <p className={styles.sourceNote}>
              Origem: <code>modules/progression/src/level-policy.ts</code> ·{" "}
              <code>{ACCOUNT_LEVEL_POLICY_VERSION}</code>
            </p>
          </Panel>
          <Panel className={styles.specCard} as="article">
            <h3>Insígnias</h3>
            <p>
              <code className={styles.inlineCode}>BadgeAward</code>: concessão com definição
              versionada, evento de origem, estado e revogação motivada. Slot vazio permanece
              vazio — nenhuma insígnia é inventada para preencher espaço.
            </p>
            <p className={styles.sourceNote}>
              Única definição publicada: <code>{PREMIUM_BADGE_CODE}</code>
            </p>
          </Panel>
          <Panel className={styles.specCard} as="article">
            <h3>Premiações</h3>
            <p>
              <code className={styles.inlineCode}>RewardAward</code>: definição, versão, status e
              fulfillment com prova e executor. Nada aparece antes de existir concessão
              registrada.
            </p>
            <p className={styles.sourceNote}>
              Nenhuma <code>RewardDefinition</code> está publicada nesta versão.
            </p>
          </Panel>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="minha-progressao">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>SUA CONTA</span>
          <h2 id="minha-progressao">Progressão da conta selecionada.</h2>
          <p className={styles.lede}>
            O nível pertence à SellerAccount selecionada no contexto de venda; a leitura é a
            projeção canônica da API, com data de referência.
          </p>
        </header>
        <SellerScopeGate>
          <ScopedAchievements />
        </SellerScopeGate>
      </section>

      <section className={styles.section} aria-labelledby="conquistas-publicas">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>REGRAS PÚBLICAS</span>
          <h2 id="conquistas-publicas">O que você já pode conferir hoje.</h2>
          <p className={styles.lede}>
            As regras que alimentam esta tela são públicas e versionadas: níveis 1–10 com
            critério por faixa, a única insígnia definida e a fórmula do ranking mensal.
          </p>
        </header>
        <div className={styles.linkRow}>
          <Link className="button-link" href="/recompensas">Ver níveis e recompensas</Link>
          <Link className="text-link" href="/ranking">{COPY.ranking.header.cta}</Link>
        </div>
      </section>
    </div>
  );
}
