import { expect, request, test, type APIRequestContext } from "@playwright/test";

type MailpitSearchResponse = {
  messages?: Array<{ ID?: string }>;
};

type MailpitMessage = {
  Text?: string;
};

const mailpitUrl = process.env.MAILPIT_API_URL ?? "http://127.0.0.1:8025";

test("landing abre como loja, usa movimento finito e mostra inventário na primeira dobra", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "O item vem primeiro." })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Buscar no marketplace" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progresso na vitrine" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Inspecionar em 3D/i })).toHaveAttribute(
    "href",
    "/itens/ochpoch-market/3d?from=%2F",
  );
  await expect(page.locator('img[src*="ochpoch-market-vault-hero-v2"]')).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Ofertas publicadas" })).toBeVisible();
  const firstOffer = page.getByRole("article").first();
  await expect(firstOffer).toBeVisible();
  expect(await firstOffer.evaluate((node) => node.getBoundingClientRect().top < window.innerHeight)).toBe(true);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".landing-model")).toHaveCount(0);
  expect(await page.evaluate(() => document.getAnimations().filter((animation) => (
    animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY
  )).length)).toBe(0);

  const parallax = page.locator(".ui-parallax").first();
  const parallaxBefore = await parallax.evaluate((node) => getComputedStyle(node).transform);
  await page.evaluate(() => window.scrollTo({ top: Math.max(400, window.innerHeight), behavior: "instant" }));
  await expect.poll(async () => Number(
    await page.getByRole("progressbar", { name: "Progresso na vitrine" }).getAttribute("aria-valuenow"),
  )).toBeGreaterThan(0);
  await expect.poll(async () => parallax.evaluate((node) => getComputedStyle(node).transform))
    .not.toBe(parallaxBefore);
});

test("landing móvel mantém duas colunas, navegação fixa e nenhuma rolagem lateral", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const firstOffer = page.getByRole("article").first();
  await expect(firstOffer).toBeVisible();
  expect(await firstOffer.evaluate((node) => {
    const grid = node.parentElement;
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
  })).toBe(2);
  await expect(page.getByRole("navigation", { name: "Navegação principal móvel" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("@webgl ponte da home abre viewer dedicado com um único modelo", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let modelRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/ochpoch-market.glb")) modelRequests += 1;
  });

  await page.goto("/");
  await page.getByRole("link", { name: /Inspecionar em 3D/i }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/itens/ochpoch-market/3d");
  expect(new URL(page.url()).searchParams.get("from")).toBe("/");
  await expect(page.getByRole("heading", { level: 1, name: /símbolo.*ângulos/i })).toBeVisible();
  const stage = page.locator(".viewer-stage");
  await expect(stage).toHaveAttribute("data-model-status", "ready", { timeout: 30_000 });
  await expect(stage.getByText("3D pronto")).toBeVisible();
  await expect(stage.locator("canvas")).toHaveCount(1);
  await expect.poll(() => modelRequests).toBe(1);
  await expect(page.getByRole("link", { name: /Voltar/i }).first()).toHaveAttribute("href", "/");

  await page.getByRole("button", { name: "Ângulo" }).click();
  await page.getByRole("button", { name: "Redefinir" }).click();
  await expect(stage.locator("canvas")).toHaveCount(1);
});

test("@webgl anúncio abre o viewer 3D e volta à oferta de origem", async ({ page }) => {
  const origin = "/anuncios/ochpoch-market-emblem-founder";
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(origin);

  await page.getByRole("link", { name: /Inspecionar em 3D/i }).click();

  await expect.poll(() => new URL(page.url()).pathname).toBe(
    "/itens/ochpoch-market-emblem/3d",
  );
  expect(new URL(page.url()).searchParams.get("from")).toBe(origin);

  const stage = page.locator(".viewer-stage");
  await expect(stage).toHaveAttribute("data-model-status", "ready", { timeout: 30_000 });
  await expect(stage.getByText("3D pronto")).toBeVisible();
  await expect(stage.locator("canvas")).toHaveCount(1);

  const back = page.getByRole("link", { name: /Voltar/i }).first();
  await expect(back).toHaveAttribute("href", origin);
  await back.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(origin);
});

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

test("cadastro verificado cria sessao e SellerAccount real", async ({ page }) => {
  test.slow();
  const mailpit = await request.newContext({ baseURL: mailpitUrl });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `e2e-${suffix}@example.test`;
  const password = "Senha-E2E-Longa!2026";
  const sellerName = `Operacao E2E ${suffix.slice(-6)}`;

  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "O item vem primeiro." })).toBeVisible();

    await page.goto("/cadastro");
    await page.getByLabel("Como quer ser chamado").fill("Comprador E2E");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByLabel(/aceito os termos vigentes/i).check();
    const createAccountButton = page.getByRole("button", { name: "Criar conta" });
    await expect(createAccountButton).toBeEnabled();
    await createAccountButton.click();
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

    const accountsResponse = await page.request.get("/api/backend/v1/me/seller-accounts");
    expect(accountsResponse.ok()).toBeTruthy();
    const accounts = await accountsResponse.json() as {
      data: Array<{ displayName: string; membershipRole: string }>;
    };
    expect(accounts.data).toContainEqual(expect.objectContaining({
      displayName: sellerName,
      membershipRole: "OWNER",
    }));
  } finally {
    await mailpit.dispose();
  }
});
