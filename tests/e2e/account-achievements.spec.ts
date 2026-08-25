import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * E2E-SCR-ACC-016 — /conta/conquistas com a leitura canônica publicada.
 * Prova que GET /v1/seller-accounts/{sellerAccountId}/progression é servida
 * por apps/api e que a tela sai do estado fail-closed: nível L1 real da
 * política account-level-brl.v1, valor qualificado zerado por replay do ledger
 * vazio e slots de insígnia/premiação declarados vazios, sem award inventado
 * (RF-241/RF-243).
 */

type MailpitSearchResponse = {
  messages?: Array<{ ID?: string }>;
};

type MailpitMessage = {
  Text?: string;
};

const mailpitUrl = process.env.MAILPIT_API_URL ?? "http://127.0.0.1:8025";

async function waitForVerificationUrl(mailpit: APIRequestContext, email: string): Promise<string> {
  await expect.poll(async () => {
    const response = await mailpit.get("/api/v1/search", {
      params: { query: `to:${email}`, limit: "1" },
    });
    if (!response.ok()) return null;
    const result = await response.json() as MailpitSearchResponse;
    return result.messages?.[0]?.ID ?? null;
  }, {
    message: `aguardando e-mail real de verificacao para ${email}`,
    timeout: 15_000,
  }).not.toBeNull();

  const searchResponse = await mailpit.get("/api/v1/search", {
    params: { query: `to:${email}`, limit: "1" },
  });
  expect(searchResponse.ok()).toBeTruthy();
  const search = await searchResponse.json() as MailpitSearchResponse;
  const messageId = search.messages?.[0]?.ID;
  expect(messageId).toBeTruthy();

  const messageResponse = await mailpit.get(`/api/v1/message/${encodeURIComponent(messageId!)}`);
  expect(messageResponse.ok()).toBeTruthy();
  const message = await messageResponse.json() as MailpitMessage;
  const verificationUrl = message.Text?.match(/https?:\/\/[^\s]+\/verificar-email\?token=[^\s]+/)?.[0];
  expect(verificationUrl).toBeTruthy();
  return verificationUrl!;
}

async function provisionSellerViaUi(page: Page, mailpit: APIRequestContext, suffix: string) {
  const email = `e2e-ach-${suffix}@example.test`;
  const password = "Senha-E2E-Longa!2026";
  const sellerName = `Conquistas E2E ${suffix.slice(-6)}`;

  await page.goto("/cadastro");
  await page.getByLabel("Como quer ser chamado").fill("Vendedor Conquistas");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByLabel(/aceito os termos vigentes/i).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Verifique seu e-mail" })).toBeVisible();

  const verificationUrl = await waitForVerificationUrl(mailpit, email);
  await page.goto(verificationUrl);
  await page.getByRole("button", { name: "Verificar e-mail" }).click();
  await expect(page.getByRole("heading", { name: "E-mail verificado" })).toBeVisible();

  await page.getByRole("link", { name: "Entrar" }).click();
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/conta(?:\?|$)/);

  await page.goto("/vender/cadastro");
  await page.getByLabel("Nome público da operação").fill(sellerName);
  await page.getByRole("button", { name: "Criar contexto de venda" }).click();
  await expect(page).toHaveURL(/\/conta\/vendas\?sellerAccountId=sac_/);

  const sellerAccountId = new URL(page.url()).searchParams.get("sellerAccountId");
  expect(sellerAccountId).toMatch(/^sac_/);
  return { sellerAccountId: sellerAccountId! };
}

test("conquistas serve a leitura canônica de progressão para a SellerAccount", async ({ page }) => {
  test.slow();
  const mailpit = await request.newContext({ baseURL: mailpitUrl });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const { sellerAccountId } = await provisionSellerViaUi(page, mailpit, suffix);

    // A leitura canônica responde 200 pelo mesmo caminho que a tela usa.
    const progressionResponse = await page.request.get(
      `/api/backend/v1/seller-accounts/${sellerAccountId}/progression`,
    );
    expect(progressionResponse.status()).toBe(200);
    const progression = await progressionResponse.json() as {
      levelAssignment: {
        policyVersion: string;
        currency: string;
        qualifiedLifetimeGmvMinor: string;
        level: string;
        nextLevelMinInclusiveMinor: string | null;
        contributionChecksum: string;
      };
      badgeAwards: unknown[];
      rewardAwards: unknown[];
      asOf: string;
      freshness: string;
    };
    expect(progression.levelAssignment).toMatchObject({
      policyVersion: "account-level-brl.v1",
      currency: "BRL",
      qualifiedLifetimeGmvMinor: "0",
      level: "L1",
      nextLevelMinInclusiveMinor: "10001",
    });
    expect(progression.levelAssignment.contributionChecksum).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(progression.badgeAwards).toEqual([]);
    expect(progression.rewardAwards).toEqual([]);
    expect(progression.freshness).toBe("READY");

    await page.goto("/conta/conquistas");
    await expect(page.getByRole("heading", { name: "Conquistas" })).toBeVisible();

    // Estado fail-closed não pode mais aparecer: a capability está publicada.
    await expect(
      page.getByText("Progressão da conta ainda não publicada pela API"),
    ).toHaveCount(0);

    await expect(page.getByText("Leitura canônica")).toBeVisible();
    const levelPanel = page.getByRole("article").filter({ hasText: "Nível da conta" });
    await expect(levelPanel.getByText("Nível 1")).toBeVisible();
    await expect(levelPanel.locator("code", { hasText: "L1" })).toBeVisible();

    const gmvPanel = page.getByRole("article").filter({ hasText: "Valor vendido qualificado" });
    await expect(gmvPanel.getByText(/R\$\s?0,00/)).toBeVisible();

    const nextPanel = page.getByRole("article").filter({ hasText: "Próxima faixa" });
    await expect(nextPanel.getByText(/A partir de R\$\s?100,01/)).toBeVisible();

    await expect(page.getByText("checksum de contribuições")).toBeVisible();

    // RF-241/RF-243: slot vazio permanece declarado e vazio.
    await expect(page.getByText("Nenhuma insígnia concedida a esta conta")).toBeVisible();
    await expect(page.getByText("Nenhuma premiação concedida a esta conta")).toBeVisible();
  } finally {
    await mailpit.dispose();
  }
});
