import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Estas suítes existem para travar o espelho: as telas de progressão não podem
 * inventar faixa, taxa, fórmula ou prêmio. Tudo que a UI mostra como política é
 * comparado, valor a valor, com a policy real importada do domínio em
 * `modules/progression/src/`.
 *
 * O import relativo atravessa o pacote de propósito: `@midas/progression` não é
 * dependência declarada de `@midas/web`, e declará-la exigiria alterar
 * `apps/web/package.json` + rodar `pnpm install`, o que está fora do escopo
 * desta entrega. O teste, porém, roda no workspace inteiro e consegue ler a
 * fonte canônica — então a divergência é detectada aqui em vez de virar mentira
 * na tela.
 */
import {
  assignAccountLevel,
  INITIAL_ACCOUNT_LEVEL_POLICY,
} from "../../../../modules/progression/src/level-policy.js";
import {
  calculateLeaderboardScore,
  formatHalfPoints as domainFormatHalfPoints,
  INITIAL_LEADERBOARD_POLICY,
} from "../../../../modules/progression/src/leaderboard-policy.js";
import { INITIAL_LISTING_PLAN_POLICY } from "../../../../modules/progression/src/listing-plan-policy.js";
import { PREMIUM_10_BADGE_CODE } from "../../../../modules/progression/src/contribution-replay.js";

import {
  ACCOUNT_LEVEL_CURRENCY,
  ACCOUNT_LEVEL_LADDER,
  ACCOUNT_LEVEL_POLICY_VERSION,
  levelCriterion,
  levelIntervalMinor,
  LevelLadder,
  UNPUBLISHED_REWARD_LABEL,
} from "./level-ladder";
import {
  formatBasisPoints,
  LISTING_PLAN_POLICY_VERSION,
  LISTING_PLAN_TABLE,
  PREMIUM_BADGE_CODE,
  RewardsView,
} from "./rewards-view";
import {
  BASE_MINOR_PER_POINT,
  formatPoints,
  leaderboardHalfPoints,
  LEADERBOARD_CURRENCY,
  LEADERBOARD_ENDPOINT,
  LEADERBOARD_POLICY_VERSION,
  LeaderboardView,
  PREMIUM_BONUS_HALF_POINTS_PER_WHOLE_BRL,
  TIEBREAK_ORDER,
  type LeaderboardResponse,
} from "./leaderboard-view";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Texto que transformaria uma política em promessa. Nenhuma tela pode conter. */
const promiseTraps: readonly RegExp[] = Object.freeze([
  /garantid[oa]/iu,
  /\bem breve\b/iu,
  /\bganhe\b/iu,
  /\bvagas?\b/iu,
  /\bcorra\b/iu,
  /prêmio de r\$/iu,
  /você (vai|irá) receber/iu,
  /\baté \d+% de desconto\b/iu,
]);

function expectNoPromise(text: string) {
  for (const trap of promiseTraps) {
    expect(trap.test(text), `texto proibido encontrado por ${trap.source}`).toBe(false);
  }
}

describe("escada de níveis espelha a policy do domínio", () => {
  it("usa a mesma versão e a mesma moeda", () => {
    expect(ACCOUNT_LEVEL_POLICY_VERSION).toBe(INITIAL_ACCOUNT_LEVEL_POLICY.version);
    expect(ACCOUNT_LEVEL_CURRENCY).toBe(INITIAL_ACCOUNT_LEVEL_POLICY.currency);
  });

  it("reproduz faixa por faixa, na mesma ordem, sem lacuna", () => {
    expect(ACCOUNT_LEVEL_LADDER).toHaveLength(INITIAL_ACCOUNT_LEVEL_POLICY.definitions.length);

    ACCOUNT_LEVEL_LADDER.forEach((entry, index) => {
      const definition = INITIAL_ACCOUNT_LEVEL_POLICY.definitions[index];
      expect(definition, `nível ${String(index + 1)} ausente no domínio`).toBeDefined();
      expect(entry.level).toBe(definition.level);
      expect(entry.ordinal).toBe(index + 1);
      expect(entry.minInclusiveMinor).toBe(definition.minInclusiveMinor);
      expect(entry.maxInclusiveMinor).toBe(definition.maxInclusiveMinor);
    });
  });

  it("mantém as bordas coerentes com assignAccountLevel", () => {
    for (const entry of ACCOUNT_LEVEL_LADDER) {
      expect(assignAccountLevel(entry.minInclusiveMinor).level).toBe(entry.level);
      if (entry.maxInclusiveMinor !== null) {
        expect(assignAccountLevel(entry.maxInclusiveMinor).level).toBe(entry.level);
        expect(assignAccountLevel(entry.maxInclusiveMinor + 1).level).not.toBe(entry.level);
      }
      if (entry.minInclusiveMinor > 0) {
        expect(assignAccountLevel(entry.minInclusiveMinor - 1).level).not.toBe(entry.level);
      }
    }
  });

  it("descreve o critério com o limite pertencendo ao nível anterior", () => {
    const first = ACCOUNT_LEVEL_LADDER[0];
    const second = ACCOUNT_LEVEL_LADDER[1];
    const last = ACCOUNT_LEVEL_LADDER[ACCOUNT_LEVEL_LADDER.length - 1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(last).toBeDefined();

    expect(levelCriterion(first)).toBe("De R$ 0,00 até R$ 100,00");
    expect(levelCriterion(second)).toBe("Acima de R$ 100,00 até R$ 500,00");
    expect(levelCriterion(last)).toBe("Acima de R$ 50.000,00");
    expect(levelIntervalMinor(first)).toBe("0..10000");
    expect(levelIntervalMinor(last)).toBe("5000001..");
  });
});

describe("LevelLadder", () => {
  it("é uma lista ordenada de dez níveis com critério e slot de benefício", () => {
    const { container } = render(<LevelLadder />);

    const list = container.querySelector("ol");
    expect(list).not.toBeNull();
    expect(list).toHaveAttribute("role", "list");

    const items = within(list as HTMLElement).getAllByRole("listitem");
    expect(items).toHaveLength(10);

    expect(screen.getByRole("heading", { name: /Nível 1\b/u })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Nível 10\b/u })).toBeInTheDocument();
    expect(screen.getAllByText(UNPUBLISHED_REWARD_LABEL)).toHaveLength(10);
    expect(screen.getByText("De R$ 0,00 até R$ 100,00")).toBeInTheDocument();
    expect(screen.getByText("Acima de R$ 50.000,00")).toBeInTheDocument();
  });

  it("abre a regra de cada nível por elemento nativo, sem script de motion", () => {
    const { container } = render(<LevelLadder />);
    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(10);
    for (const element of details) {
      expect(element.querySelector("summary")).not.toBeNull();
    }
  });

  it("não promete recompensa em nenhum nível", () => {
    const { container } = render(<LevelLadder />);
    expectNoPromise(container.textContent);
  });
});

describe("planos de anúncio espelham a policy comercial", () => {
  it("usa a mesma versão da política", () => {
    expect(LISTING_PLAN_POLICY_VERSION).toBe(INITIAL_LISTING_PLAN_POLICY.version);
  });

  it("reproduz taxa, exposição, fila, bônus e campanha de cada plano", () => {
    expect(LISTING_PLAN_TABLE).toHaveLength(INITIAL_LISTING_PLAN_POLICY.definitions.length);

    LISTING_PLAN_TABLE.forEach((row, index) => {
      const definition = INITIAL_LISTING_PLAN_POLICY.definitions[index];
      expect(definition, `plano ${row.code} ausente no domínio`).toBeDefined();
      expect(row.code).toBe(definition.code);
      expect(row.platformFeeRateBps).toBe(definition.platformFeeRateBps);
      expect(row.exposurePriority).toBe(definition.exposurePriority);
      expect(row.queuePriority).toBe(definition.queuePriority);
      expect(row.premiumBonusHalfPointsPerWholeBrl)
        .toBe(definition.premiumBonusHalfPointsPerWholeBrl);
      expect(row.premiumBadgeCampaignVersion).toBe(definition.premiumBadgeCampaignVersion);
      expect(row.premiumBadgeRequiredSales).toBe(definition.premiumBadgeRequiredSales);
    });
  });

  it("usa o código de insígnia do domínio", () => {
    expect(PREMIUM_BADGE_CODE).toBe(PREMIUM_10_BADGE_CODE);
  });

  it("converte basis points por aritmética inteira", () => {
    expect(formatBasisPoints(750)).toBe("7,50%");
    expect(formatBasisPoints(1_000)).toBe("10,00%");
    expect(formatBasisPoints(1_200)).toBe("12,00%");
    expect(formatBasisPoints(5)).toBe("0,05%");
  });
});

describe("RewardsView", () => {
  it("entrega escada, insígnia definida e ausência declarada de premiação", () => {
    render(<RewardsView />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(10);
    expect(screen.getByText(PREMIUM_BADGE_CODE)).toBeInTheDocument();
    expect(screen.getByText("premium-10-completed-sales.v1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nenhuma premiação publicada" })).toBeInTheDocument();
  });

  it("publica a tabela de planos com semântica de tabela de dados", () => {
    render(<RewardsView />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Taxa da venda" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: /Premium/u })).toBeInTheDocument();
    expect(table.querySelector("caption")).not.toBeNull();
    expect(within(table).getByText("12,00%")).toBeInTheDocument();
  });

  it("não promete item que ainda não existe", () => {
    const { container } = render(<RewardsView />);
    const text = container.textContent;
    expectNoPromise(text);
    expect(text).toContain(UNPUBLISHED_REWARD_LABEL);
  });
});

describe("fórmula do ranking espelha a policy do domínio", () => {
  it("usa a mesma versão, moeda e constantes", () => {
    expect(LEADERBOARD_POLICY_VERSION).toBe(INITIAL_LEADERBOARD_POLICY.version);
    expect(LEADERBOARD_CURRENCY).toBe(INITIAL_LEADERBOARD_POLICY.currency);
    expect(BASE_MINOR_PER_POINT).toBe(INITIAL_LEADERBOARD_POLICY.baseMinorPerPoint);
    expect(PREMIUM_BONUS_HALF_POINTS_PER_WHOLE_BRL)
      .toBe(INITIAL_LEADERBOARD_POLICY.premiumBonusHalfPointsPerWholeBrl);
  });

  it("calcula exatamente como calculateLeaderboardScore", () => {
    const samples: readonly (readonly [number, number])[] = [
      [0, 0],
      [999, 0],
      [1_000, 0],
      [10_000, 0],
      [10_000, 10_000],
      [10_050, 50],
      [123_456, 7_800],
      [5_000_001, 1_234_567],
    ];

    for (const [eligibleGmvMinor, eligiblePremiumGmvMinor] of samples) {
      const mirrored = leaderboardHalfPoints(eligibleGmvMinor, eligiblePremiumGmvMinor);
      const domain = calculateLeaderboardScore({ eligibleGmvMinor, eligiblePremiumGmvMinor });
      expect(mirrored.baseHalfPoints).toBe(domain.baseHalfPoints);
      expect(mirrored.premiumBonusHalfPoints).toBe(domain.premiumBonusHalfPoints);
      expect(mirrored.totalHalfPoints).toBe(domain.totalHalfPoints);
      expect(formatPoints(mirrored.totalHalfPoints))
        .toBe(domainFormatHalfPoints(domain.totalHalfPoints));
    }
  });

  it("reproduz o exemplo literal da especificação: R$ 100 vale 10 ou 60 pontos", () => {
    expect(formatPoints(leaderboardHalfPoints(10_000, 0).totalHalfPoints)).toBe("10");
    expect(formatPoints(leaderboardHalfPoints(10_000, 10_000).totalHalfPoints)).toBe("60");
    expect(formatPoints(1)).toBe("0,5");
  });

  it("mantém a ordem de desempate completa e versionada", () => {
    expect(TIEBREAK_ORDER).toHaveLength(5);
    expect(TIEBREAK_ORDER[0]).toMatch(/pontos/iu);
    expect(TIEBREAK_ORDER[4]).toMatch(/determinística/iu);
  });
});

describe("LeaderboardView", () => {
  function stubFetch(response: Response) {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response)));
  }

  function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  it("entrega fórmula, moeda e desempate mesmo sem projeção publicada", async () => {
    stubFetch(jsonResponse(
      { title: "Não encontrado", status: 404, code: "CAPABILITY_NOT_IMPLEMENTED" },
      404,
    ));

    render(<LeaderboardView />);

    expect(await screen.findByRole("heading", {
      name: "Classificação ainda não publicada pela API",
    })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(LEADERBOARD_ENDPOINT, "u"), {
      selector: "code",
    })).toBeInTheDocument();
    expect(screen.getByLabelText("Fórmula de pontuação da temporada")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Temporada" })).toBeDisabled();
    expect(screen.getByText("Nenhuma temporada publicada")).toBeInTheDocument();
    expect(screen.getByRole("heading", {
      name: "Nenhuma premiação de temporada publicada",
    })).toBeInTheDocument();
  });

  it("anuncia a mudança assíncrona da classificação em região live", () => {
    stubFetch(jsonResponse({ title: "Não encontrado", status: 404 }, 404));
    const { container } = render(<LeaderboardView />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("mostra o exemplo aritmético sem apresentá-lo como venda real", () => {
    stubFetch(jsonResponse({ title: "Não encontrado", status: 404 }, 404));
    render(<LeaderboardView />);

    const example = screen.getAllByRole("table")[0];
    expect(example).toBeDefined();
    expect(example.querySelector("caption")?.textContent).toMatch(/não é venda, vendedor nem posição real/iu);
    expect(within(example).getByText("60 pontos")).toBeInTheDocument();
  });

  it("renderiza a classificação como tabela acessível quando a projeção existir", async () => {
    const page: LeaderboardResponse = {
      data: [
        {
          rank: 1,
          maskedLabel: "Vendedor A••••",
          totalHalfPoints: 120,
          eligibleGmvMinor: "10000",
          eligiblePremiumGmvMinor: "10000",
        },
        {
          rank: 2,
          maskedLabel: "Vendedor B••••",
          totalHalfPoints: 21,
          eligibleGmvMinor: "10050",
          eligiblePremiumGmvMinor: "50",
        },
      ],
      season: {
        seasonId: "01900000-0000-7000-8000-0000000000aa",
        month: "2026-08",
        status: "FINAL",
        currency: "BRL",
      },
      seasons: [
        {
          seasonId: "01900000-0000-7000-8000-0000000000aa",
          month: "2026-08",
          status: "FINAL",
        },
      ],
      asOf: "2026-08-24T12:00:00.000Z",
    };
    stubFetch(jsonResponse(page, 200));

    render(<LeaderboardView />);

    const classification = await screen.findByRole("rowheader", { name: "1" });
    const table = classification.closest("table");
    expect(table).not.toBeNull();
    if (!table) return;

    expect(table.querySelector("caption")?.textContent).toMatch(/Identidade mascarada/u);
    expect(within(table).getByRole("columnheader", { name: "Pontos" })).toBeInTheDocument();
    expect(within(table).getByText("Vendedor A••••")).toBeInTheDocument();
    expect(within(table).getByText("60")).toBeInTheDocument();
    expect(within(table).getByText("10,5")).toBeInTheDocument();
    expect(within(table).getAllByText("Premiação ainda não publicada")).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: "Temporada" })).toBeEnabled();
  });

  it("não expõe identidade real: o tipo publicado só carrega rótulo mascarado", async () => {
    const page: LeaderboardResponse = {
      data: [{
        rank: 1,
        maskedLabel: "Vendedor A••••",
        totalHalfPoints: 2,
        eligibleGmvMinor: "1000",
        eligiblePremiumGmvMinor: "0",
      }],
      asOf: "2026-08-24T12:00:00.000Z",
    };
    stubFetch(jsonResponse(
      { ...page, data: [{ ...page.data[0], sellerAccountId: "sac_real", legalName: "Fulano" }] },
      200,
    ));

    render(<LeaderboardView />);

    const cell = await screen.findByText("Vendedor A••••");
    const table = cell.closest("table");
    expect(table).not.toBeNull();
    expect(table?.textContent ?? "").not.toContain("sac_real");
    expect(table?.textContent ?? "").not.toContain("Fulano");
  });
});
