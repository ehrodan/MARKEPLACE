import Link from "next/link";
import { PageState, Panel, StatusBadge } from "@midas/ui";
import { COPY } from "@/lib/copy-deck";
import {
  ACCOUNT_LEVEL_POLICY_VERSION,
  LevelLadder,
  QUALIFIED_GMV_FORMULA,
  UNPUBLISHED_REWARD_LABEL,
} from "./level-ladder";
import styles from "./progression.module.css";

/**
 * /recompensas — SCR-PUB-015.
 *
 * Contrato (docs/07-MAPA-DE-TELAS-E-FLUXOS.md linha 112): "Explicar níveis
 * 1–10, critérios, benefícios, insígnias e premiações sem prometer item ainda
 * não definido", a partir de `AccountLevelDefinition`, `BadgeDefinition` e
 * `RewardDefinition` publicados e vigentes.
 *
 * Estado real desta versão:
 * - `AccountLevelDefinition` → publicado no domínio (`INITIAL_ACCOUNT_LEVEL_POLICY`),
 *   renderizado na escada de níveis;
 * - `BadgeDefinition` → uma única definição existe no domínio, derivada de
 *   `INITIAL_LISTING_PLAN_POLICY.PREMIUM` + `PREMIUM_10_BADGE_CODE`
 *   (`modules/progression/src/contribution-replay.ts`);
 * - `RewardDefinition` → nenhuma publicada. A seção existe, declara a ausência
 *   e não sugere prêmio futuro.
 *
 * Nada aqui é dado de vendedor: a tela publica política versionada, não
 * métrica de conta. Por isso não há fetch nesta superfície.
 *
 * Perfil de motion M1: expansão de `<details>` e nada além disso.
 */

const plansCopy = COPY.rewards;

export type ListingPlanCode = "BASIC" | "VIP" | "PREMIUM";

export interface ListingPlanRow {
  readonly code: ListingPlanCode;
  readonly label: string;
  readonly platformFeeRateBps: number;
  readonly exposurePriority: "STANDARD" | "PRIORITY" | "MAXIMUM";
  readonly queuePriority: "STANDARD" | "HIGH" | "MAXIMUM";
  readonly premiumBonusHalfPointsPerWholeBrl: number;
  readonly premiumBadgeCampaignVersion: string | null;
  readonly premiumBadgeRequiredSales: number | null;
}

/**
 * Espelho literal de `modules/progression/src/listing-plan-policy.ts` →
 * `INITIAL_LISTING_PLAN_POLICY`. Travado por
 * `components/progression/level-ladder.test.tsx`, que importa a policy real e
 * reprova divergência de código, taxa, prioridade, bônus ou campanha.
 */
export const LISTING_PLAN_POLICY_VERSION = "listing-plan-brl.v1";

const planRows: readonly ListingPlanRow[] = [
  {
    code: "BASIC",
    label: "Básico",
    platformFeeRateBps: 750,
    exposurePriority: "STANDARD",
    queuePriority: "STANDARD",
    premiumBonusHalfPointsPerWholeBrl: 0,
    premiumBadgeCampaignVersion: null,
    premiumBadgeRequiredSales: null,
  },
  {
    code: "VIP",
    label: "VIP",
    platformFeeRateBps: 1_000,
    exposurePriority: "PRIORITY",
    queuePriority: "HIGH",
    premiumBonusHalfPointsPerWholeBrl: 0,
    premiumBadgeCampaignVersion: null,
    premiumBadgeRequiredSales: null,
  },
  {
    code: "PREMIUM",
    label: "Premium",
    platformFeeRateBps: 1_200,
    exposurePriority: "MAXIMUM",
    queuePriority: "MAXIMUM",
    premiumBonusHalfPointsPerWholeBrl: 1,
    premiumBadgeCampaignVersion: "premium-10-completed-sales.v1",
    premiumBadgeRequiredSales: 10,
  },
];

export const LISTING_PLAN_TABLE: readonly ListingPlanRow[] = Object.freeze(
  planRows.map((row) => Object.freeze(row)),
);

/** `modules/progression/src/contribution-replay.ts` → `PREMIUM_10_BADGE_CODE`. */
export const PREMIUM_BADGE_CODE = "PREMIUM_10_COMPLETED_SALES";

const exposureLabels: Readonly<Record<ListingPlanRow["exposurePriority"], string>> = {
  STANDARD: "Padrão",
  PRIORITY: "Prioritária",
  MAXIMUM: "Máxima",
};

const queueLabels: Readonly<Record<ListingPlanRow["queuePriority"], string>> = {
  STANDARD: "Padrão",
  HIGH: "Alta",
  MAXIMUM: "Máxima",
};

/**
 * Basis points → percentual, por aritmética inteira (sem ponto flutuante):
 * 750 bps = "7,50%". A taxa é a que o domínio guarda, não um número escolhido
 * para a tela.
 */
export function formatBasisPoints(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const fraction = Math.abs(bps % 100);
  return `${String(whole)},${String(fraction).padStart(2, "0")}%`;
}

function premiumBadgeRow(): ListingPlanRow | undefined {
  return LISTING_PLAN_TABLE.find((row) => row.premiumBadgeCampaignVersion !== null);
}

export function RewardsView() {
  const premium = premiumBadgeRow();

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="recompensas-titulo">
        <div>
          <span className={styles.heroKicker}>{plansCopy.header.kicker}</span>
          <h1 id="recompensas-titulo">{plansCopy.header.headline}</h1>
        </div>
        <p className={styles.heroLede}>
          <strong>{plansCopy.header.subhead}</strong>
          {plansCopy.header.body}
        </p>
      </section>

      <LevelLadder />

      <section className={styles.section} aria-labelledby="o-que-conta">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>{plansCopy.level.kicker}</span>
          <h2 id="o-que-conta">{plansCopy.level.headline}</h2>
          <p className={styles.lede}>{plansCopy.level.subhead} {plansCopy.level.body}</p>
        </header>

        <pre className={styles.formula} aria-label="Fórmula do valor vendido qualificado">
          {QUALIFIED_GMV_FORMULA}
        </pre>

        <div className={styles.cardGrid}>
          <Panel className={styles.specCard}>
            <h3>Entra no cálculo</h3>
            <ul className={styles.plainList}>
              <li>Valor bruto de mercadoria em BRL de pedidos concluídos.</li>
              <li>Pagamentos liquidados, já fora da retenção.</li>
            </ul>
          </Panel>
          <Panel className={styles.specCard}>
            <h3>Não entra no cálculo</h3>
            <ul className={styles.plainList}>
              <li>Venda pendente, cancelada, em quarentena, autorreferente ou fraudulenta.</li>
              <li>Refunds e chargebacks canônicos, que são subtraídos.</li>
              <li>Taxa do plano e taxa do provedor de pagamento — elas não reduzem o valor de progressão.</li>
            </ul>
          </Panel>
          <Panel className={styles.specCard}>
            <h3>Moeda e reversão</h3>
            <p>
              Somente BRL entra nesta política. Reembolso posterior pode reduzir o nível corrente;
              a mudança é recalculada por contribuição registrada, nunca por contador editado à mão.
            </p>
          </Panel>
        </div>

        <p className={styles.sourceNote}>{plansCopy.level.microcopy}</p>
      </section>

      <section className={styles.section} aria-labelledby="insignias">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>INSÍGNIAS</span>
          <h2 id="insignias">Uma insígnia está definida.</h2>
          <p className={styles.lede}>
            Insígnia não é concedida direto no perfil: existe definição versionada, evento de
            origem e registro de concessão. Abaixo está a única definição que o domínio publica
            nesta versão.
          </p>
        </header>

        {premium ? (
          <Panel className={styles.specCard}>
            <div>
              <StatusBadge tone="info">Definição publicada</StatusBadge>
            </div>
            <h3>Dez vendas Premium concluídas</h3>
            <dl className={styles.ruleList}>
              <div>
                <dt>Código</dt>
                <dd><code>{PREMIUM_BADGE_CODE}</code></dd>
              </div>
              <div>
                <dt>Campanha</dt>
                <dd><code>{premium.premiumBadgeCampaignVersion}</code></dd>
              </div>
              <div>
                <dt>Marco</dt>
                <dd>
                  {premium.premiumBadgeRequiredSales === null
                    ? "Marco ainda não publicado."
                    : `${String(premium.premiumBadgeRequiredSales)} pedidos distintos com snapshot de plano Premium.`}
                </dd>
              </div>
              <div>
                <dt>Elegibilidade</dt>
                <dd>
                  Pedidos concluídos, liquidados, não autorreferentes e ainda não revertidos.
                  Retry e replay do mesmo evento não contam duas vezes.
                </dd>
              </div>
              <div>
                <dt>Unicidade</dt>
                <dd>Uma concessão por conta de vendedor e por versão da campanha.</dd>
              </div>
              <div>
                <dt>Reversão</dt>
                <dd>
                  Refund ou chargeback antes da concessão reduz a contagem. Depois da concessão,
                  vale a política de reversão publicada junto da campanha.
                </dd>
              </div>
              <div>
                <dt>Arte da insígnia</dt>
                <dd>
                  Ainda não publicada. O arquivo é validado e liberado pelo painel de governança
                  antes de aparecer em qualquer perfil.
                </dd>
              </div>
            </dl>
          </Panel>
        ) : (
          <PageState
            kind="empty"
            title="Nenhuma insígnia definida"
            description="Nenhuma BadgeDefinition consta na política vigente. Nada é exibido no lugar."
            reference="SCR-PUB-015 · BadgeDefinition"
          />
        )}
      </section>

      <section className={styles.section} aria-labelledby="premiacoes">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>PREMIAÇÕES</span>
          <h2 id="premiacoes">{UNPUBLISHED_REWARD_LABEL}.</h2>
          <p className={styles.lede}>
            Uma premiação só existe depois de publicada com nome, termos, vigência,
            elegibilidade, limite e forma de entrega. Enquanto isso não acontece, esta seção
            permanece vazia de propósito.
          </p>
        </header>

        <PageState
          kind="empty"
          title="Nenhuma premiação publicada"
          description="Nenhuma RewardDefinition vigente foi encontrada para os níveis 1–10. Esta tela não antecipa prêmio, cupom, benefício ou valor que ainda não foi definido."
          reference="SCR-PUB-015 · RewardDefinition"
        />
      </section>

      <section className={styles.section} aria-labelledby="plano-vs-nivel">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>PLANO DO ANÚNCIO</span>
          <h2 id="plano-vs-nivel">Plano do anúncio não é nível da conta.</h2>
          <p className={styles.lede}>
            O nível vem do histórico vendido e não pode ser comprado. O plano é uma escolha
            comercial por anúncio, com taxa e prioridade publicadas antes da publicação e
            congeladas no anúncio e no pedido.
          </p>
        </header>

        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <caption>
              Planos de anúncio vigentes na política <code>{LISTING_PLAN_POLICY_VERSION}</code>.
              A taxa da venda é deduzida do repasse do vendedor e incide sobre o valor bruto de
              mercadoria do pedido.
            </caption>
            <thead>
              <tr>
                <th scope="col">Plano</th>
                <th scope="col">Taxa da venda</th>
                <th scope="col">Exposição</th>
                <th scope="col">Fila de atendimento</th>
                <th scope="col">Ranking e insígnia</th>
              </tr>
            </thead>
            <tbody>
              {LISTING_PLAN_TABLE.map((row) => (
                <tr key={row.code}>
                  <th scope="row">
                    {row.label} <code className={styles.ladderCode}>{row.code}</code>
                  </th>
                  <td className={styles.numeric}>
                    <span className={styles.emphasisCell}>{formatBasisPoints(row.platformFeeRateBps)}</span>
                    {" "}({String(row.platformFeeRateBps)} bps)
                  </td>
                  <td>{exposureLabels[row.exposurePriority]}</td>
                  <td>{queueLabels[row.queuePriority]}</td>
                  <td>
                    {row.premiumBonusHalfPointsPerWholeBrl > 0
                      ? "Bônus de pontos no ranking e elegibilidade à insígnia de dez vendas Premium."
                      : "Sem bônus de pontos e sem insígnia associada."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className={styles.sourceNote}>
          Origem no domínio: <code>modules/progression/src/listing-plan-policy.ts</code>. Níveis em{" "}
          <code>{ACCOUNT_LEVEL_POLICY_VERSION}</code>; planos em{" "}
          <code>{LISTING_PLAN_POLICY_VERSION}</code>. Trocar plano não altera pedido já feito: a
          versão fica congelada no snapshot do anúncio.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="proximo-passo">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>PRÓXIMO PASSO</span>
          <h2 id="proximo-passo">Ver a regra funcionando.</h2>
        </header>
        <div className={styles.linkRow}>
          <Link className="button-link" href="/ranking">{COPY.ranking.header.cta}</Link>
          <Link className="text-link" href="/cadastro">Criar conta de vendedor</Link>
          <Link className="text-link" href="/market">Explorar o marketplace</Link>
        </div>
      </section>
    </div>
  );
}
