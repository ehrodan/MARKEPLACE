# Midas Marketplace — dossiê pré-código

Especificação de produto, arquitetura, segurança, operação e direção de arte para um motor genérico de marketplace de itens digitais.

> **Estado:** GO documental para handoff pré-código. **NO-GO para operar com Standoff 2** sem autorização comercial e técnica escrita da Axlebolt, licença dos ativos e dados, mecanismo autorizado de transferência e PSP contratado.

Este repositório é documental e independente. Não possui afiliação com Axlebolt, Standoff 2, Nesha Store ou standoff-2.com. Não contém PNGs, credenciais, código de checkout nem integração não oficial.

## Entregáveis

- [Relatório mestre em PDF](reports/MIDAS-RELATORIO-MESTRE.pdf) — versão A4 com 114 páginas.
- [Relatório mestre em HTML](reports/MIDAS-RELATORIO-MESTRE.html) — versão navegável e responsiva.
- [Síntese executiva e gates](docs/00-RELATORIO-MESTRE.md).
- [PRD completo](docs/01-PRD-MIDAS.md) — 180 requisitos funcionais e 25 não funcionais.
- [UML e arquitetura](docs/02-UML-ARQUITETURA.md) — 22 diagramas de domínio e integração.
- [Direção de arte](docs/03-DIRECAO-DE-ARTE.md) — sistema visual Midas Foundry.
- [Segurança, compliance e operações](docs/04-SEGURANCA-COMPLIANCE-OPERACOES.md).
- [Backlog e roadmap G0–G8](docs/05-BACKLOG-ROADMAP.md).
- [Inventário de referências e política de ativos](docs/06-INVENTARIO-REFERENCIAS-E-ASSETS.md).
- [Tokens visuais](tokens.css).

## Escopo coberto

O material especifica painéis Master e ADM com permissões granulares, marketplace P2P, canal “Compre do Midas”, catálogo administrável, crafts com quatro posições, aprovação manual, busca e recomendação, gráfico de referência, chat anti-PII, propostas, checkout via PSP, entrega segura, confirmação bilateral, hold de sete dias, saque, disputas, tickets, caixa de e-mail, 2FA, passkeys e confiança de dispositivo.

A arquitetura usa monólito modular no MVP, PostgreSQL, outbox/inbox, ledger imutável e PSP regulado. Pagamento só é reconhecido por webhook assinado e reconciliado. Liquidação tardia entra em `PAYMENT_QUARANTINED` e só segue por reassociação atômica da mesma unidade ou reembolso idempotente.

## Validação

- 180/180 requisitos funcionais contínuos.
- 25/25 requisitos não funcionais contínuos.
- 23/23 diagramas renderizados no relatório consolidado.
- PDF com 114 páginas, sem páginas vazias.
- Zero erro de renderização e zero overflow horizontal nos seis viewports testados.
- Revisão independente sem P0 ou P1 residual no pacote final.

## Gates obrigatórios antes de código comercial

1. Autorização escrita da Axlebolt para comércio, integração e uso de propriedade intelectual.
2. API ou feed público, documentado e licenciado para catálogo e preços.
3. Licença expressa para imagens e demais ativos.
4. Mecanismo autorizado de prova, transferência e entrega dos itens.
5. Contrato com PSP compatível com split, retenção, reembolso, chargeback e payout.
6. Definição jurídica, fiscal, etária, de privacidade, disputa e seller onboarding.
7. Matriz automatizada de rastreabilidade individual de `RF-001` a `RF-180` para fechar G4.

Até esses gates serem atendidos, a implementação permitida é somente um protótipo clean-room ou motor genérico com dados sintéticos.

## Fontes oficiais centrais

- [Regras do Standoff 2](https://help.standoff2.com/pt-BR/articles/8446575-regras-do-jogo)
- [EULA do Standoff 2](https://standoff2.com/en/eula.html)
- [Código de Conduta](https://help.standoff2.com/en/articles/15253027-code-of-conduct)
- [Central oficial do Marketplace](https://help.standoff2.com/en/collections/3850927-marketplace)
- [Licença oficial de assets](https://standoff2.com/assets/AXLEBOLT_Assets_license_EN.pages)
