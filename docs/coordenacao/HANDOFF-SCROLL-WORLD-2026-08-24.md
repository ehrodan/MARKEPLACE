# Handoff — home pública + scroll-world

Data: 2026-08-24  
Estado: **IMPLEMENTAÇÃO VISUAL EXECUTADA · PIPELINE CINEMATOGRÁFICO AINDA NÃO AUTORIZADO**

## Fonte estudada

- Projeto: <https://github.com/oso95/scroll-world>
- Commit auditado: `71cc36d3bb150248ae36a2c552f9cbf88802a79c`
- Licença: MIT
- Natureza: pipeline de stills e vídeos pré-renderizados, com o tempo do vídeo
  controlado pelo scroll. Não é um pacote React/Three pronto para instalar.

## O que entrou agora

- Hero compacto com o cenário próprio `ochpoch-market-vault-hero-v2.png`.
- `Reveal`, `ParallaxLayer`, `Tilt3D` e `ScrollProgress` do `@midas/ui`, sem
  adicionar biblioteca e com `prefers-reduced-motion` preservado.
- CTA primário para a vitrine e CTA secundário para o viewer GLB real.
- Microinterações coerentes em busca, conta, filtros, cards e CTAs.
- Home continua sem canvas; o WebGL permanece isolado na rota de inspeção.
- Correção da ponte anúncio → viewer: `ochpoch-market-emblem` deixou de cair
  em 404. O retorno à oferta usa uma origem interna allowlisted.

## Por que o scrub de vídeo completo não entrou

O efeito completo do `scroll-world` depende de artefatos que ainda não existem
e de serviços pagos. Nesta máquina não foram encontrados `monid`, `higgsfield`,
`ffmpeg`, `ffprobe` ou `blender`. Nenhum crédito foi gasto e nenhum vídeo foi
fingido com uma imagem estática.

## Lacunas para o modo cinematográfico completo

1. Escolher a linguagem de câmera: fly-through/diorama, caminhada contínua ou
   isométrico travado.
2. Definir entre 5 e 7 cenas e aprovar os stills de início/fim de cada trecho.
3. Autorizar um provedor de geração de vídeo e um orçamento antes de qualquer
   chamada paga.
4. Decidir se haverá vídeos 9:16 próprios para mobile; isso adiciona uma
   segunda sequência de renders.
5. Instalar/verificar `ffmpeg` e gerar os encodes com GOP curto para seek.
6. Integrar clips reais com blob URLs, prefetch progressivo, crossfade,
   priming de iOS e stills equivalentes em movimento reduzido.
7. Rodar QA de seams frame a frame, consumo de memória, 375/768/1440 e rede
   lenta. Sem baseline anterior, regressão visual deve ser marcada como
   inconclusiva, não como PASS.

## Arquivos principais deste passe

- `apps/web/components/landing/storefront-intro.tsx`
- `apps/web/components/landing/storefront-intro.module.css`
- `apps/web/app/page.tsx`
- `apps/web/lib/brand.ts`
- `apps/web/lib/viewer-routing.ts`
- `apps/web/app/itens/[slug]/3d/page.tsx`
- `apps/web/components/listing-detail/listing-gallery.tsx`
- `tests/e2e/account-bootstrap.spec.ts`

## Gate para o próximo agente

Não substituir a home por `StoreOverture`/R3F nem vendorizar o scrub engine sem
clips reais e sem aprovação das três decisões acima (câmera, mobile, orçamento).
Preservar catálogo na primeira dobra, zero canvas na home e rota 3D fail-closed.
