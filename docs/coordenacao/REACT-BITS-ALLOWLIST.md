# React Bits — allowlist controlada

- **Estado efetivo:** `EMPTY / BLOCKED_LEGAL_TECHNICAL`
- **Commit inspecionado:** `4e0e030193b563be6be33d928f77d0d01cefe237`
- **Variante única candidata:** `TS-TW` — TypeScript + Tailwind
- **Última verificação remota:** 2026-08-23

## Regra de autorização

Uma linha `CANDIDATE` **não autoriza cópia, instalação nem importação**. Somente `APPROVED`, acompanhado de `legalEvidence`, revisão técnica e testes registrados, entra no runtime. Nenhuma linha está aprovada nesta versão.

| Componente | Caminho fixado no commit | Dependência declarada na origem | Escopo máximo proposto | Estado |
|---|---|---|---|---|
| `FadeContent` | `src/ts-tailwind/Animations/FadeContent/FadeContent.tsx` | `gsap@^3.13.0` | shell público/auth não crítico; fallback imediato | `CANDIDATE / BLOCKED` |
| `AnimatedContent` | `src/ts-tailwind/Animations/AnimatedContent/AnimatedContent.tsx` | `gsap@^3.13.0` | entrada única de grid/cards; nunca tabela financeira | `CANDIDATE / BLOCKED` |
| `DarkVeil` | `src/ts-tailwind/Backgrounds/DarkVeil/DarkVeil.tsx` | `ogl@^1.0.11` | piloto de hero na Home; nunca coexistir com viewer 3D | `CANDIDATE / BLOCKED` |
| `BlurText` | `src/ts-tailwind/TextAnimations/BlurText/BlurText.tsx` | `motion@^12.23.12` | headline editorial; texto final disponível sem animação | `CANDIDATE / BLOCKED` |
| `Stepper` | `src/ts-tailwind/Components/Stepper/Stepper.tsx` | `motion@^12.23.12` | progresso não financeiro; estado canônico fora do componente | `CANDIDATE / BLOCKED` |
| `AnimatedList` | `src/ts-tailwind/Components/AnimatedList/AnimatedList.tsx` | `motion@^12.23.12` | atividade não crítica; sem reordenar fatos | `CANDIDATE / BLOCKED` |
| `CountUp` | `src/ts-tailwind/TextAnimations/CountUp/CountUp.tsx` | `motion@^12.23.12` | agregado não financeiro com valor final estável | `CANDIDATE / BLOCKED` |

Fonte imutável: [árvore do commit](https://github.com/DavidHDev/react-bits/tree/4e0e030193b563be6be33d928f77d0d01cefe237).

## Exclusão explícita

Está negado sem nova decisão formal:

- qualquer outro componente ou qualquer commit diferente;
- instalação/clonagem do repositório React Bits inteiro no runtime;
- cursores, efeitos globais de clique, backgrounds contínuos pesados ou componentes que interceptem scroll/foco;
- uso em checkout, saldo, ledger, saque, pagamento, reembolso, disputa, segurança ou decisão staff;
- distribuição do código em template, tema vendável, SDK, biblioteca, bundle para tenant ou produto de componentes;
- coexistência de `DarkVeil`/outro canvas React Bits com Three.js/R3F;
- resolução automática de `^` para uma versão não registrada no lockfile e no notice.

## Gates por componente

Para mudar uma linha para `APPROVED`, anexar todos os campos:

```text
component:
sourceCommit:
sourcePath:
sourceSha256:
resolvedDependencies:
licenseEvidence:
legalEvidence:
allowedRoutes:
forbiddenRoutes:
wrapperPath:
featureFlag:
fallback:
bundleDelta:
a11yEvidence:
ssrHydrationEvidence:
reducedMotionEvidence:
cleanupEvidence:
reviewers:
approvedAt:
```

`legalEvidence` precisa analisar a [licença MIT + Commons Clause](https://github.com/DavidHDev/react-bits/blob/4e0e030193b563be6be33d928f77d0d01cefe237/LICENSE.md) e a licença de cada dependência resolvida. Em especial, `gsap` declara licença própria “Standard no charge”; ela não pode ser tratada automaticamente como MIT.

## Gate de execução

Mesmo após aprovação jurídica, o adapter deve:

1. preservar conteúdo e ordem DOM sem JavaScript de motion;
2. respeitar `prefers-reduced-motion` sem atraso artificial;
3. não alterar nome acessível, foco, preço, CTA ou estado de domínio;
4. desmontar RAF, observers, listeners e canvas;
5. passar E2E desktop/mobile e budget antes de habilitar a flag;
6. registrar a versão efetivamente resolvida de `gsap`, `motion` ou `ogl` em `THIRD_PARTY_NOTICES.md`.
