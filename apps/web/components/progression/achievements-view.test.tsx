import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SellerAccountSummary } from "@/lib/api-types";

/**
 * SCR-ACC-016 — /conta/conquistas.
 *
 * A leitura canônica GET /v1/seller-accounts/{sellerAccountId}/progression
 * ainda não é servida por apps/api. Estas suítes travam os dois lados do
 * contrato honesto: (a) enquanto a API responde 404/501 a tela declara a
 * capability ausente sem inventar nível, insígnia ou premiação (RF-241/243);
 * (b) quando a leitura existir, nível, awards e freshness saem do payload —
 * e slot vazio continua vazio.
 *
 * O AccountProvider real depende de next/navigation; aqui o contexto de conta
 * é substituído por módulo, exatamente como o AccountShell o entregaria.
 */

const accountContext = vi.hoisted(() => ({ current: {} }));

vi.mock("@/components/account/account-context", () => ({
  useAccountContext: () => accountContext.current,
}));

import {
  AchievementsView,
  PROGRESSION_ENDPOINT_TEMPLATE,
  progressionEndpoint,
  type AccountProgressionResponse,
} from "./achievements-view";

function seller(): SellerAccountSummary {
  return {
    sellerAccountId: "sac_01",
    displayName: "Forja do Norte",
    accountType: "INDIVIDUAL",
    sellerAccountStatus: "ACTIVE",
    version: 1,
  };
}

function useSellerContext(selected: SellerAccountSummary | undefined) {
  accountContext.current = {
    sellerAccounts: selected ? [selected] : [],
    selectedSeller: selected,
    sellerAccountsStatus: "ready",
    sellerAccountsError: undefined,
    retrySellerAccounts: () => undefined,
    selectSeller: () => undefined,
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(response: Response) {
  const mock = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", mock);
  return mock;
}

function progressionPage(
  overrides: Partial<AccountProgressionResponse> = {},
): AccountProgressionResponse {
  return {
    levelAssignment: {
      policyVersion: "account-level-brl.v1",
      currency: "BRL",
      qualifiedLifetimeGmvMinor: "12000",
      level: "L2",
      nextLevelMinInclusiveMinor: 50_001,
      contributionChecksum: "fnv1a64:00000000deadbeef",
    },
    badgeAwards: [
      {
        badgeCode: "PREMIUM_10_COMPLETED_SALES",
        definitionVersion: "premium-10-completed-sales.v1",
        status: "ACTIVE",
        awardedAt: "2026-08-01T12:00:00.000Z",
        sourceEventId: "evt_progression_01",
      },
    ],
    rewardAwards: [],
    asOf: "2026-08-24T12:00:00.000Z",
    freshness: "READY",
    ...overrides,
  };
}

/** Texto que transformaria a tela em promessa ou simulação. */
const promiseTraps: readonly RegExp[] = Object.freeze([
  /garantid[oa]/iu,
  /\bem breve\b/iu,
  /\bganhe\b/iu,
  /\bcorra\b/iu,
  /você (vai|irá) receber/iu,
  /prêmio de r\$/iu,
]);

function expectNoPromise(text: string) {
  for (const trap of promiseTraps) {
    expect(trap.test(text), `texto proibido encontrado por ${trap.source}`).toBe(false);
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AchievementsView — capability ausente (estado real desta versão)", () => {
  it("declara o contrato ausente fail-closed e aponta as regras públicas reais", async () => {
    useSellerContext(seller());
    const fetchMock = stubFetch(jsonResponse(
      { title: "Não encontrado", status: 404, code: "CAPABILITY_NOT_IMPLEMENTED" },
      404,
    ));

    const { container } = render(<AchievementsView />);

    expect(screen.getByRole("heading", { level: 1, name: "Conquistas" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", {
      name: "Progressão da conta ainda não publicada pela API",
    })).toBeInTheDocument();

    // A consulta foi feita ao contrato canônico real, com o seller do contexto.
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/backend${progressionEndpoint("sac_01")}`,
      expect.anything(),
    );
    // A referência exibe o contrato ausente de forma verificável.
    expect(screen.getByText(
      (content, element) => element?.tagName === "CODE"
        && content.includes(`GET ${PROGRESSION_ENDPOINT_TEMPLATE}`),
    )).toBeInTheDocument();

    // O que a tela vai exibir permanece declarado, com origem no domínio.
    expect(screen.getByRole("heading", { name: "Nível e progresso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Insígnias" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Premiações" })).toBeInTheDocument();

    // Caminhos públicos reais disponíveis hoje.
    expect(screen.getByRole("link", { name: "Ver níveis e recompensas" }))
      .toHaveAttribute("href", "/recompensas");
    expect(screen.getByRole("link", { name: "Ver ranking" }))
      .toHaveAttribute("href", "/ranking");

    // Nenhum nível, award ou progresso simulado; nenhuma promessa.
    expect(screen.queryByText("Leitura canônica")).toBeNull();
    expectNoPromise(container.textContent);
  });

  it("anuncia a mudança assíncrona da progressão em região live", () => {
    useSellerContext(seller());
    stubFetch(jsonResponse({ title: "Não encontrado", status: 404 }, 404));
    const { container } = render(<AchievementsView />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});

describe("AchievementsView — leitura publicada", () => {
  it("renderiza nível, valor qualificado, insígnia concedida e freshness do payload", async () => {
    useSellerContext(seller());
    stubFetch(jsonResponse(progressionPage(), 200));

    const { container } = render(<AchievementsView />);

    // Nível espelhado da policy vigente (12000 centavos cai em L2).
    expect(await screen.findByText("Nível 2")).toBeInTheDocument();
    expect(screen.getByText("R$ 120,00")).toBeInTheDocument();
    expect(screen.getByText(/Acima de R\$ 100,00 até R\$ 500,00/u)).toBeInTheDocument();
    expect(screen.getByText(/A partir de R\$ 500,01/u)).toBeInTheDocument();

    // Insígnia real do payload, com definição versionada e estado. O código
    // também aparece no contrato declarado da tela, então o teste olha só a
    // região da progressão.
    const region = screen.getByRole("region", { name: "Progressão da conta selecionada." });
    const badgeCell = within(region).getByText("PREMIUM_10_COMPLETED_SALES");
    const badgeTable = badgeCell.closest("table");
    expect(badgeTable).not.toBeNull();
    if (!badgeTable) return;
    expect(within(badgeTable).getByText("premium-10-completed-sales.v1")).toBeInTheDocument();
    expect(within(badgeTable).getByText("Ativa")).toBeInTheDocument();
    expect(within(badgeTable).getByText("evt_progression_01")).toBeInTheDocument();

    // Premiação sem concessão fica vazia — nada é antecipado.
    expect(screen.getByRole("heading", {
      name: "Nenhuma premiação concedida a esta conta",
    })).toBeInTheDocument();

    expectNoPromise(container.textContent);
  });

  it("mantém o slot de insígnia vazio quando não há BadgeAward (RF-241/243)", async () => {
    useSellerContext(seller());
    stubFetch(jsonResponse(progressionPage({
      badgeAwards: [],
      rewardAwards: [
        {
          rewardCode: "REWARD_EXEMPLO",
          definitionVersion: "reward.v1",
          status: "FULFILLED",
          awardedAt: "2026-08-02T09:00:00.000Z",
          fulfilledAt: "2026-08-03T09:00:00.000Z",
        },
      ],
    }), 200));

    render(<AchievementsView />);

    expect(await screen.findByRole("heading", {
      name: "Nenhuma insígnia concedida a esta conta",
    })).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Progressão da conta selecionada." });
    expect(within(region).queryByText("PREMIUM_10_COMPLETED_SALES")).toBeNull();
    expect(within(region).getByText("REWARD_EXEMPLO")).toBeInTheDocument();
    expect(within(region).getByText("Entregue")).toBeInTheDocument();
  });
});

describe("AchievementsView — bloqueios", () => {
  it("sem SellerAccount, o gate declara a ausência de contexto e nada é consultado", () => {
    useSellerContext(undefined);
    const fetchMock = stubFetch(jsonResponse({}, 200));

    render(<AchievementsView />);

    expect(screen.getByRole("heading", {
      name: "Você ainda não tem um contexto de venda",
    })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar a vender" }))
      .toHaveAttribute("href", "/vender/cadastro");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sessão expirada pede autenticação em vez de inventar progresso", async () => {
    useSellerContext(seller());
    stubFetch(jsonResponse(
      { title: "Entre para continuar", status: 401, code: "AUTHENTICATION_REQUIRED" },
      401,
    ));

    render(<AchievementsView />);

    expect(await screen.findByRole("heading", {
      name: "Sua sessão precisa ser renovada",
    })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar");
    expect(screen.queryByText("Leitura canônica")).toBeNull();
  });
});
