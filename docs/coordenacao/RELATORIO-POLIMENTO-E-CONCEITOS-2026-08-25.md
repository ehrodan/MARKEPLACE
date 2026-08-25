# Relatório — Polimento, conceitos dos livros e o que falta do PRD

**Data:** 2026-08-25 · **Branch:** `codex/rf181-202-conta-reembolsos` · **Sessão:** Claude (3075e2de)

## 1. Estado medido na largada (comandos reais)

| Gate | Resultado |
|---|---|
| `pnpm report:screens:functional` | 95/95 rotas · 43/95 dedicadas · 52 `CONTRACT_REQUIRED` |
| `pnpm --filter @midas/web test` | 56 arquivos · **562/562 testes** (após onda 1) |
| `pnpm --filter @midas/web typecheck` | exit 0 |
| `pnpm --filter @midas/web lint` | exit 0 (1ª rodada falhou por concorrência com sessão paralela; rerun limpo) |
| `theme-rarity.test.ts` | 2/2 |

## 2. Tema público — linha do tempo da decisão

1. Fork verde ácido (hue 128) **reprovava** o guardrail `theme-rarity.test.ts` (8° da raridade UNCOMMON 120; mínimo 12°).
2. Reconciliei pro ouro canônico (docs/03/18 + CLAIM Nesha "ouro é ação").
3. **Dono decidiu (2026-08-25): "tema mais tech, voltado para jogos de armas" — ouro não agradou.**
4. Estado vigente: aço frio (matiz 250) + **liquid-lime hue 100** como única cor de ação (20° da UNCOMMON — passa o guardrail), ciano 195 restaurado como sinal informativo, ouro reservado à marca/produto/conta. Registrado em `CLAIM-CLAUDE-ONDA3-LOOPS-20260825.md`.

## 3. Onda 1 entregue (5 clusters, testes verdes)

- **Nav + landing:** contagem real do carrinho na nav (eventos focus/storage), link Favoritos, "Vender" em outline, announcement e hero com copy de valor factual, footer 4 grupos com rotas reais. 14/14 testes.
- **Market:** hero enxuto, chips de categoria com contagem real, card com placeholder por raridade, FavoriteButton no card, escassez honesta ("Só N em estoque" quando 1≤N≤5, número do banco), skeleton em formato de card. 21 testes do cluster verdes.
- **Detalhe do anúncio:** FavoriteButton fiado (contrato WIRING-favoritos §2), escassez honesta, título display 3rem, moldura de raridade na galeria, disclaimers cortados pela metade, procedência em `<details>`, vendedor com avatar/perfil. 24/24.
- **ScreenContract (53 stubs):** página "em preparação" digna da marca — SCR-ID, título humano, "nada aqui é simulado", CTA pro /market, contrato técnico em `<details>`. 4/4.
- **Conta:** atalhos agrupados, recompra honesta (RF-262/263) — "Ver oferta atual" via publicSlug REAL do snapshot do pedido; sem slug → "Procurar item semelhante"; helper `repurchase.ts` + testes. 16/16.
- **Fundação:** `FavoriteButton` compartilhado (components/favorites/favorite-button.tsx, 4 testes) + reconciliação de tema.

## 4. Auditoria dos livros — conceitos NÃO implementados (3 auditores)

### 4.1 Gatilhos (Sugarman · neuromarketing · BBB3 · marketing-psychology)

Já forte: honestidade como DNA (copy-deck testado), especificidade (números exatos), objeção→resposta (taxas abertas em BigInt), prova social real (N vendidos), simplicidade (1 CTA/card).

| Faltava | Estado |
|---|---|
| Efeito dotação — FavoriteButton órfão | ✅ fechado na onda 1 (card + detalhe) |
| Ancoragem real "N ofertas deste item · a partir de R$X" no detalhe | 🔄 onda 3 (cluster D) |
| Loss aversion — destaque de queda de preço REAL em favoritos/carrinho | 🔄 onda 3 (A + E) |
| Frenesi pós-compra — slot POST_PURCHASE definido e nunca montado | 🔄 onda 3 (F) |
| Copy mostAware (Schwartz) escrita em copy-deck e nunca renderizada | pendente |
| "Minha coleção" derivada de pedidos concluídos reais | pendente |
| Reviews no anúncio | BLOQUEADO: projeção `OrderReview`/reputação pública sem endpoint |

### 4.2 Gestalt / direção de arte (Gomes Filho · Lupton)

Já forte: região comum no painel de decisão, raridade cor+texto, preço nunca anima, anti-dark-pattern exemplar (forced-colors, reduced-motion, reduced-transparency em todos os módulos).

| Violação | Estado |
|---|---|
| Ação pintando elemento NÃO clicável (~10 usos decorativos) | 🔄 onda 3 (B + C) |
| 3 larguras de página (75/82/86rem), `--page-max-public` morto | 🔄 parcial (C) |
| Microtipografia 8.8–10px espalhada | 🔄 piso .68rem (B + C) |
| cardCta sem estado pleno no toque (hover:none) | 🔄 onda 3 (C) |
| Geração antiga de detalhe (.detailPage) morta em marketplace.module.css | 🔄 onda 3 (C) |
| Sistema `ed-*` (editorial.css) pago e usado só por item-view | pendente (migração landing/market) |
| Pílula vs radius-control (brand kit: "pílula só chip") | pendente — decisão de brand |

### 4.3 Loops de retenção (Hooked · Teia de Hidra · Unbound)

Diagnóstico: backend de retenção é o mais maduro do repo; **quase nenhum loop fechava na UI**. Score Hook comprador: ~2/10 mecânica · 10/10 ética (Facilitator, zero dark pattern).

| Quebra | Estado |
|---|---|
| FavoriteButton não montado | ✅ onda 1 |
| Contrato favoritos↔API errado (POST sem `kind`; DELETE por id errado) — opt-in nunca chega à conta | 🔄 onda 3 (A) |
| Motor de trigger é código morto: `evaluatePriceChange/evaluateStockChange/markTriggered` sem chamadores no worker | 🔄 onda 3 (G) |
| Sem sino/unreadCount na nav (API já devolve o número) | 🔄 onda 3 (B) |
| `/v1/me/saved-cart` + recover nunca chamados pela web | 🔄 onda 3 (E) |
| /conta/conquistas stub (SCR-ACC-016) | 🔄 onda 3 (H) |
| Rotas órfãs sem link (favoritos/notificações/ranking/recompensas) | ✅ parcial onda 1 (nav) · resto em B |

## 5. O que falta do PRD (gate funcional, 2026-08-25)

**52–53 superfícies `CONTRACT_REQUIRED`** (rota responde, corte vertical não existe):

| Família | Dedicadas | Faltam |
|---|---:|---:|
| Pública | 9 | 6 (`/midas`, `/ajuda[/:slug]`, `/seguranca`, `/politicas[/:slug]`) |
| Conta | 10 | 6 (recuperar-acesso, verificar-idade, privacidade×2, recurso, conquistas*) |
| Comprador | 8 | 4 (mensagens×2, suporte×2) |
| Vendedor | 14 | 3–4 (/vender saúde, equipe, saque detalhe, studio) |
| Admin | 1 | 17 (filas inteiras: anúncios, KYC, disputas, financeiro, pagamentos…) |
| Master | 1 | 7 |
| Growth | 0 | 9 |

*conquistas em curso na onda 3. Ordem recomendada P0→P2 e critérios de "dedicada" em `RELATORIO-TELAS-FALTANTES-2026-08-25.md`.

**Bloqueios estruturais (não são tela):** PSP/Pix sem provider homologado (pagamento/saque fail-closed — correto); upload binário/antivírus/pipeline 2D→3D; search index; projeção pública de reputação; evento canônico de preço/estoque no outbox (pré-requisito do motor de triggers — cluster G vai medir).

## 6. Onda 3 em execução (8 clusters)

A favoritos-sync · B sino+landing · C market-gestalt · D âncora+watch no detalhe · E saved-cart+queda de preço · F pós-compra · G motor de triggers (worker) · H conquistas. Fronteiras no `CLAIM-CLAUDE-ONDA3-LOOPS-20260825.md`.

## 7. Próximo passo exato (depois da onda 3)

1. Gate completo (`lint`, `typecheck`, `test`, `report:screens:functional`) + verificação DOM no dev server.
2. Commit da onda.
3. P0 das telas: `/seguranca` e `/midas` com conteúdo versionado; mensagens (anti-BOLA) e admin/anúncios exigem onda própria com API.
4. Pendentes dos livros: copy mostAware, coleção do comprador, migração `ed-*`, decisão pílula.
