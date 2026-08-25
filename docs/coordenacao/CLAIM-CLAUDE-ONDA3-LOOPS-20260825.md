# CLAIM — Onda 3: loops de recompra + gestalt sweep

**Responsável temporário:** Claude (sessão 3075e2de, Claude Code desktop)
**Início:** 2026-08-25 03:35 BRT
**Estado:** ATIVO

## Arquivos claimados (fronteiras por agente, disjuntas)

- `apps/web/components/favorites/**` — fix contrato watchlist POST/DELETE + destaque de queda de preço real
- `apps/web/components/landing/**` + `apps/web/components/account/account-shell.*` — sino com unreadCount real, links órfãos, gestalt (ouro/ação decorativa fora)
- `apps/web/components/marketplace/**` — gestalt sweep (ação decorativa, piso tipográfico, hover:none, aposentar .detailPage antiga)
- `apps/web/components/listing-detail/**` — âncora "N ofertas · a partir de R$X" real + watch de reposição no esgotado
- `apps/web/components/cart/**` — saved-cart real via API + linha de queda de preço real
- `apps/web/components/checkout/**` — slot POST_PURCHASE do RecommendationRail
- `apps/worker/**` + `modules/retention/**` (aditivo) — ligar motor de trigger (evaluate* → enqueue → markTriggered)
- `apps/web/app/conta/conquistas/**` + `apps/web/components/progression/**` — SCR-ACC-016 v1 com dados reais/fail-closed

## Tema público — decisão vigente (não reabrir sem direção nova do dono)

`.public-commerce-theme` em `apps/web/app/globals.css`: aço frio 250 + **liquid-lime hue 100** como única ação (direção do dono: "tema mais tech voltado para jogos de armas"; o ouro não agradou). Guardrail `components/marketplace/theme-rarity.test.ts` passa (20° da UNCOMMON 120; mínimo 12°). Sinal informativo restaurado como ciano 195 (`--color-signal`), nunca preenchendo ação. Sessões paralelas: NÃO regravar o bloco sem registrar decisão aqui.

## Evidência na largada

- `pnpm --filter @midas/web test` — 56 arquivos / 562 testes passaram (03:26 BRT)
- `pnpm --filter @midas/web typecheck` — exit 0
- `pnpm --filter @midas/web lint` — exit 0 (rerun; primeira rodada falhou por concorrência com sessão paralela)
- `theme-rarity.test.ts` — 2/2 com o lime 100
