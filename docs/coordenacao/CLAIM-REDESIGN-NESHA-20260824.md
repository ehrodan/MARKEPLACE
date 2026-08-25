# CLAIM — redesign comercial da home

**Responsável temporário:** Codex `/root`  
**Início:** 2026-08-24 16:47 BRT  
**Estado:** RELEASED — gate da reabertura concluído em 2026-08-25 03:37 BRT

> Coordenação: não sobrescrever `apps/web/app/globals.css` nem os arquivos da
> vitrine enquanto o gate desta rodada estiver em execução. A ação volta a ser
> liquid-lime, com matiz separada da raridade `UNCOMMON` pelo teste executável.

**Gate da reabertura:** 56 arquivos/562 testes, TypeScript, ESLint, build de
produção, 95/95 rotas e smoke em `localhost:3000` passaram. A ação liquid-lime
usa hue 100; o Studio manteve um Canvas após troca de imagem; o símbolo da marca
recebe escala específica no card sem reduzir as demais ofertas.

## Arquivos claimados

- `apps/web/app/page.tsx`
- `apps/web/components/landing/announcement-bar.*`
- `apps/web/components/landing/public-nav.*`
- `apps/web/components/landing/storefront-intro.*`
- `apps/web/components/landing/landing-catalog.*`
- `apps/web/components/landing/storefront-footer.*`
- `apps/web/components/marketplace/listing-card.tsx`
- `apps/web/components/marketplace/marketplace-shell.tsx`
- `apps/web/components/marketplace/marketplace.module.css`
- testes diretamente ligados a essas superfícies

## Direção mais recente do dono

1. Corrigir design, cores, hierarquia, responsividade e animações sem sentido.
2. Aproximar a anatomia comercial da Nesha: busca dominante, vitrine densa e produto na primeira dobra.
3. Aplicar `livro-big-black-book-3`, `livro-direcao-de-arte-e-ux-design` e `livro-gestalt-20250311204543`.

## Decisão medida

- `StoreOverture`, `IntroPiece`, `PriceTicker`, `StoreBanners`, `Reveal` e `Tilt3D` ficam fora da home neste passe.
- Motivo: duplicam a promessa, criam mais de uma figura por dobra e empurram a primeira oferta para fora de 1280x720.
- O viewer 3D permanece na rota dedicada SCR-PUB-013.
- Ouro é ação clicável; ciano é sinal informativo; raridade é dado. Nenhuma cor de ação em decoração.

## Evidência final executada

- `pnpm --filter @midas/web typecheck` — passou.
- `pnpm --filter @midas/web lint` — passou.
- `pnpm --filter @midas/web test` — 42 arquivos / 489 testes passaram.
- E2E da home em `chromium-desktop` — 2/2 passaram com `reducedMotion: no-preference`.
- E2E da home em `chromium-mobile` — 2/2 passaram com `reducedMotion: no-preference`.
- `pnpm --filter @midas/web build` — build Next 16.3.2 passou, com 79 páginas estáticas geradas.
- Preview de produção em `127.0.0.1:3000` — HTTP 200, headline presente, sem `price-ticker` e sem `<canvas>` na home.
- Capturas finais: `ochpoch-final2-fold-desktop-20260824.png` e `ochpoch-final2-fold-mobile-20260824.png`.

## Ponte com Claude / central

- O handoff existente `HANDOFF-LOJA-ESCURA-E-GRAFO-DOCS.md` foi lido e as partes úteis foram integradas sem reintroduzir elementos que empurram o catálogo.
- A sessão Claude `b20bd78d-649d-4cb0-8efa-201f96ce98f0` sobrescreveu `page.tsx` e `storefront-intro.tsx` durante o gate, apesar deste claim. Ela foi pausada de forma reversível; o Claude Desktop permaneceu aberto.
- A decisão canônica também foi gravada no MCP `central`, registro `a43dee22-b5f1-4afe-9590-14daef0d245b`.
- Não retomar a execução antiga sobre estes arquivos. Uma nova crítica deve partir deste estado validado e respeitar o pedido mais recente do dono.

## Feedback da sessão par

Não houve aprovação nova da sessão Claude após este claim: a tentativa de follow-up pelo perfil CLI encontrou autenticação indisponível. O material efetivamente incorporado veio do handoff e do transcript já existentes; não registrar como revisão/aprovação do resultado final.
