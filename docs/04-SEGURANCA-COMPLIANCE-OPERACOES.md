# Segurança, compliance e operações — Midas

> Planejamento técnico e de produto; não substitui parecer jurídico, contábil, regulatório ou contratual. As conclusões legais devem ser confirmadas por profissionais responsáveis antes de operação real.

## 1. Gate P0 — direito de operar

### Estado: NO-GO para Standoff 2

As [Regras oficiais do Standoff 2 em português](https://help.standoff2.com/pt-BR/articles/8446575-regras-do-jogo), atualizadas em 03/07/2026, proíbem comércio externo e esquemas de intermediação envolvendo itens, moedas, contas ou APIs por dinheiro real, salvo permissão expressa. A [EULA oficial](https://standoff2.com/en/eula.html) proíbe comprar, vender, alugar ou compartilhar contas/credenciais e restringe o uso comercial de conteúdo e bens virtuais. O [Code of Conduct](https://help.standoff2.com/en/articles/15253027-code-of-conduct) também proíbe procurar compra/venda e compartilhar contato para esse fim.

Consequências:

- não publicar Market P2P nem Compre do Midas para Standoff 2;
- não habilitar venda/entrega de contas;
- não raspar/integrar endpoints internos ou não oficiais;
- não baixar/republicar PNGs sem licença comercial;
- não prometer entrega oficial P2P: a [FAQ de economia](https://help.standoff2.com/en/articles/10817904-f-a-q) afirma que o jogo não pretende oferecer troca direta entre amigos;
- solicitar autorização escrita da Axlebolt cobrindo negócio, território, tipos de item, transferência, API, caching, gráfico, ativos, marca e auditoria.

Até a autorização existir, o único caminho seguro é um motor genérico/protótipo com dados sintéticos e arte própria.

## 2. Gates de compliance

| Gate | Condição de aprovação | Owner |
|---|---|---|
| LIC | autorização escrita do publicador por jogo | Direção/Jurídico |
| DATA | API pública/documentada/licenciada e direito de exibição | Produto/Engenharia |
| ASSET | licença comercial, proveniência e marca permitida | Design/Jurídico |
| PAY | PSP e fluxo de fundos/split/hold/payout aprovados; saldo de vendas administrado pelo PSP | Financeiro/Jurídico |
| AGE | acesso provável por menores, age assurance e parental controls | Privacidade/Produto |
| MOD | regras, evidência, recurso e revisão humana | Trust & Safety |
| SEC | MFA, IAM, auditoria, incidente, DR e testes | Segurança |
| CONS | oferta, checkout, entrega, arrependimento, disputa e suporte | Produto/Jurídico |

## 3. Baseline de consumo no Brasil

A oferta deve ser clara e vinculante conforme o [Código de Defesa do Consumidor](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm), especialmente arts. 6º, 14 e 30–39, e o [Decreto do Comércio Eletrônico](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm).

### Antes de pagar

Exibir e congelar no snapshot do pedido:

- razão social/CNPJ e canais da plataforma;
- identidade pública e papel do vendedor;
- item exato, versão, craft e quatro posições;
- preço total, taxas, moeda e referência em gold separada;
- disponibilidade, restrições e mecanismo de entrega;
- prazo de disponibilidade do saldo de vendas administrado pelo PSP, payout/saque e consequências de disputa/chargeback;
- política de cancelamento, arrependimento, reembolso e evidência;
- versão dos termos e consentimentos aplicáveis.

### Arrependimento e cancelamento

O CDC, art. 49, prevê sete dias em contratos fora do estabelecimento. A aplicação a cada bem digital já entregue exige parecer específico; Midas não deve supor que “entrega instantânea” elimina automaticamente o direito. O produto precisa nascer com cancelamento/estorno e comunicação ao PSP.

### Atendimento

O Decreto 7.962/2013 exige confirmação imediata da demanda e resposta eficaz em até cinco dias. O sistema de tickets deve ter protocolo, estado, SLA, responsável, escalonamento e histórico. Restrição ou banimento jamais elimina acesso a suporte/recurso.

### Persuasão ética

Proibido:

- contador ou estoque falsos;
- preço riscado não praticado;
- avaliação/prova social inventada;
- CTA disfarçado ou cancelamento escondido;
- pressão em usuário vulnerável;
- recomendação paga sem rótulo;
- urgência sem fonte e expiração auditáveis.

## 4. Crianças e adolescentes

A [Lei 15.211/2025 — ECA Digital](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm) vigora desde 17/03/2026 e alcança serviços dirigidos ou de acesso provável por menores, conforme a [orientação da ANPD](https://www.gov.br/anpd/pt-br/assuntos/eca-digital).

Como o produto está ligado a jogo, `GATE-AGE` é P0. Um checkbox “tenho 18 anos” não encerra o problema.

### Requisitos protetivos

- avaliação documentada de acesso provável e riscos;
- privacidade protetiva por padrão;
- aferição de idade proporcional;
- controle/supervisão parental quando aplicável;
- chat mais restrito por padrão;
- ranking contextual e personalização desligável;
- sem perfilamento para publicidade comercial de menores;
- sem padrões que estimulem uso compulsivo;
- limites de compra, notificação e horário conforme política aprovada.

O [Decreto 12.880/2026](https://planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12880.htm) exige minimização, finalidade exclusiva, auditabilidade e contestação na aferição. Imagem/cópia de documento deve ser eliminada imediatamente após extrair o sinal necessário. Armazenar somente faixa/resultado, método, confiança e expiração — separado de marketing, recomendação, KYC e device risk.

### Age assurance, responsável legal e contestação

- usar método proporcional ao risco e à funcionalidade, com modo mais protetivo quando a idade for desconhecida ou inconclusiva;
- guardar somente faixa etária/sinal, método, confiança, validade e trilha de contestação; data de nascimento exata e documento bruto não entram no perfil comum;
- separar o fornecedor de age assurance dos demais usos: ele atua como operador quando tratar dados em nome do Midas, com contrato, instruções, retenção e subprocessadores definidos;
- quando a lei, a avaliação de risco ou a jornada exigir participação do responsável, verificar o vínculo/autoridade por mecanismo próprio, registrar escopo e versão da autorização e permitir revogação ou troca do responsável;
- conta de menor e conta do responsável permanecem distintas; o responsável recebe somente controles e informações compatíveis com seu papel, sem acesso indiscriminado a mensagens ou segredos;
- revalidar o sinal em mudança material, expiração, indício de fraude ou evolução de faixa etária, sempre com recurso acessível e revisão humana;
- compras, chat, personalização e notificações aplicam a política da faixa mais protetiva até a aferição ser concluída.

## 5. LGPD e privacidade

Base: [Lei Geral de Proteção de Dados](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), princípios, bases, transparência, direitos, segurança e registro de operações.

### Inventário de finalidades

| Finalidade | Dados mínimos | Controle obrigatório |
|---|---|---|
| Conta/auth | e-mail, hash, fator, sessão | passkey/MFA, recuperação, retenção |
| Device risk | chave, IP truncado, ASN, UA family, eventos | minimização, TTL, contestação |
| Catálogo/anúncio | item, preço, mídia, seller | provenance e publicação governada |
| Pagamento | IDs PSP, valor, estado | sem PAN/CVV, conciliação, segregação |
| Chat | participantes, ciphertext, regra/strike | transparência, acesso limitado, TTL |
| Entrega | confirmações e pacote secreto | KMS, no-store, revelação auditada |
| Recomendação | eventos pseudonimizados e afinidades | opt-out, explicação, limpeza |
| Suporte | ticket, contato, contexto necessário | ABAC, anexos seguros, retenção |
| Auditoria | ator, ação, alvo e diff redigido | append-only, acesso auditado |
| Idade | faixa/resultado e validade | finalidade exclusiva e segregação |

### Direitos dos titulares e Privacy Center

O Privacy Center deve permitir pedido autenticado, protocolo e acompanhamento para: confirmação e acesso; correção; exportação/portabilidade em formato interoperável quando aplicável; anonimização, bloqueio ou eliminação; informação sobre compartilhamentos; revogação de consentimento; oposição ao tratamento; e revisão de decisão automatizada. A identidade do solicitante será verificada de forma proporcional, sem pedir mais dados que o necessário.

- cada pedido recebe owner, prazo legal/operacional, evidência de atendimento e resposta em linguagem clara;
- exportação aplica autorização, redaction de dados de terceiros, arquivo criptografado, link de curta duração e auditoria;
- eliminação propaga-se a operadores e backups conforme política; exceção por obrigação legal, exercício regular de direitos, fraude ou contrato deve ser específica, documentada e informada;
- oposição e revogação interrompem os tratamentos dependentes daquela base, sem prejudicar tratamentos sustentados por outra base válida;
- revisão humana informa resultado e razão compreensível, sem revelar regra antifraude explorável;
- usuário suspenso ou banido mantém acesso ao Privacy Center, suporte e recurso.

### Papéis, contratos e cadeia internacional

- o Midas documenta, por finalidade e fluxo, quando atua como controlador; PSP, antifraude ou outro parceiro que determine finalidades próprias deve ser mapeado como controlador independente ou conjunto, conforme a realidade, e não rotulado automaticamente como operador;
- operadores recebem instruções documentadas e DPA com confidencialidade, segurança, retenção, exclusão/devolução, auditoria, cooperação em direitos e SLA de incidente menor que o prazo regulatório;
- subprocessadores exigem inventário, finalidade, local de tratamento, mecanismo de autorização/notificação e obrigações equivalentes às do operador principal;
- transferência internacional só entra em produção após mapear países e acessos remotos, avaliar o mecanismo previsto na LGPD/regulamentação da ANPD, documentar salvaguardas e refletir isso no aviso de privacidade;
- manter registro de operações, data map, bases legais, fornecedores, decisões de controlador/operador e evidência de due diligence; mudança de fornecedor ou país reabre a avaliação.

### Cookies, analytics e opt-out

- separar cookies estritamente necessários de analytics, personalização e publicidade; não essenciais ficam desligados até a escolha válida quando consentimento for a base adotada;
- banner sem caixa pré-marcada, com “aceitar” e “recusar” igualmente acessíveis; preferências granulares e revogação tão simples quanto a aceitação;
- analytics coleta o mínimo, evita IDs cross-site e payloads com e-mail, chat, termo sensível ou segredo; parâmetros de URL são redigidos antes do envio;
- registrar versão do aviso, categorias, fornecedores, finalidade, escolha e expiração; sincronizar opt-out entre cliente, servidor, CDP e recomendador;
- usuários menores ou de idade desconhecida recebem o modo mais protetivo, sem cookies não essenciais ou publicidade comportamental por padrão;
- inventário e scanner de cookies impedem que novo SDK/tag seja publicado sem owner, base legal, retenção, país e revisão de segurança.

### Perfil comportamental

Busca, clique, favorito e compra podem formar perfil pessoal. O recomendador precisa de base legal por finalidade, minimização, retenção, LIA/RIPD, explicação “por que estou vendo”, desligamento e separação entre orgânico/patrocinado. O [Guia de Legítimo Interesse da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_hipoteses_legais_tratamento_de_dados_pessoais_legitimo_interesse) orienta finalidade, necessidade e balanceamento.

### Decisão automatizada

A LGPD, art. 20, assegura revisão e informação sobre critérios de decisão automatizada que afete interesses. Assim:

- mensagem pode ser bloqueada imediatamente por alta confiança;
- banimento permanente não será decidido só pelo classificador;
- terceiro strike cria `RESTRICTED_PENDING_REVIEW`;
- usuário recebe reason code, contagem e via de recurso;
- humano autorizado decide restaurar, suspender ou banir;
- modelo/regra, versão, confiança e reversão são auditados;
- falsos positivos e grupos afetados são medidos.

### Monitoramento de chat

Escanear telefone/e-mail/nick é tratamento de dados. Informar finalidade antifraude/moderação, restringir acesso, não reutilizar conversa para treinar modelo sem fundamento separado e nunca vazar o dado detectado em log/push. O [Marco Civil da Internet](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm), art. 10, protege conteúdo de comunicações privadas.

## 6. Plataforma, denúncia e moderação

O [Decreto 12.975/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12975.htm) ampliou deveres de governança, denúncia e transparência; a [ANPD mantém resumo oficial](https://www.gov.br/anpd/pt-br/assuntos/marco-civil-da-internet).

Requisitos:

- representante/canal permanente conforme aplicabilidade;
- denúncia de fraude/conteúdo;
- políticas versionadas e acessíveis;
- reason codes e recurso;
- transparência de moderação/risco;
- se houver boost pago, rótulo “Patrocinado” e guarda de anunciante, criativo, período, pagamento e decisões pelo prazo aplicável;
- nenhuma métrica de moderação baseada só em volume de banimentos.

## 7. Pagamentos e desenho regulatório

### Posição

Midas não deve criar carteira própria sacável, captar depósitos nem custodiar fundos na conta operacional. O valor devido ao vendedor será denominado **saldo de vendas administrado pelo PSP**: o PSP contratado mantém/administra o fluxo financeiro; o ledger Midas apenas espelha eventos e obrigações para UX, conciliação e auditoria. A interface não usará “carteira Midas”, “depósito” ou “escrow” sem produto e enquadramento contratual/regulatório correspondentes. A [Lei 12.865/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12865.htm) disciplina instituições/arranjos e contas de pagamento; o [Banco Central explica as modalidades](https://www.bcb.gov.br/estabilidadefinanceira/instituicaopagamento). Marketplaces que recebem e repassam após comissão podem atuar como subcredenciadores, segundo o [FAQ oficial do BCB](https://www.bcb.gov.br/estabilidadefinanceira/faq-liquidacao-centralizada).

Contratar PSP compatível com:

- marketplace/subcontas ou split;
- Pix/cartão sem PAN/CVV no Midas;
- KYC/KYB de vendedor;
- delayed payout/reserva se contratualmente suportado;
- refund, dispute e chargeback;
- saldo negativo e reserva de risco;
- payout e webhook assinado;
- relatórios de settlement e reconciliação.

Verificar autorização no [Encontre uma instituição do BCB](https://bcb.gov.br/meubc/encontreinstituicao?modalAberto=Tipos_de_Instituicoes).

### Nomenclatura e estados financeiros

- `PENDING`: pagamento ainda não liquidado pelo PSP; não compõe saldo do vendedor;
- `ADMINISTERED_HOLD`: saldo de vendas administrado pelo PSP, indisponível até a data/motivo informado;
- `AVAILABLE_FOR_PAYOUT`: saldo de vendas administrado pelo PSP elegível a payout, ainda não transferido;
- `PAYOUT_PROCESSING`, `PAID_OUT`, `REVERSED` e `DISPUTED`: estados derivados de eventos canônicos do PSP;
- nenhum valor muda de estado por retorno do navegador, cron sem prova ou edição administrativa direta; correção financeira ocorre por lançamento compensatório e evento idempotente;
- telas e extratos separam valor bruto, comissão Midas, tarifa PSP, ajustes, reserva/disputa e líquido, sempre com origem e `asOf`.

### Hold de sete dias

Não existe autorização legal geral encontrada para reter o saldo de vendas administrado pelo PSP por sete dias. O prazo precisa ser:

- contratual e suportado pelo PSP;
- informado antes da venda;
- ligado a risco objetivo;
- iniciado em marco inequívoco;
- pausado por disputa/chargeback;
- visível com início, fim e motivo;
- liberado por evento idempotente;
- nunca chamado “escrow” sem produto jurídico/contratual correspondente.

### Ledger e conciliação

- ledger interno registra obrigação; não prova custódia;
- partida dobrada por moeda;
- correção somente por reversão;
- clearing PSP reconciliado intradiária e diariamente;
- divergência congela o payout relacionado;
- browser redirect nunca confirma pagamento;
- webhook exige raw body, assinatura, timestamp, ID único e consulta canônica quando disponível.

### PCI DSS mesmo com checkout hospedado

Checkout redirecionado, hosted fields ou tokenização reduzem o escopo, mas não eliminam as responsabilidades do comerciante. Antes do go-live, PSP/adquirente e, quando necessário, QSA devem definir o escopo e a validação aplicável conforme o [PCI Security Standards Council](https://www.pcisecuritystandards.org/).

- Midas nunca recebe, registra, captura em analytics ou persiste PAN completo, CVV ou dados equivalentes;
- inventariar páginas, scripts, tags e integrações que possam afetar a página de pagamento; terceiros entram por allowlist, versionamento, CSP e monitoramento de alteração;
- cumprir o SAQ/atestação indicado pelo adquirente, varreduras e testes aplicáveis, sem presumir automaticamente SAQ A apenas por usar iframe ou redirect;
- manter diagrama de fluxo, responsabilidade compartilhada, evidência anual e contato de incidente do PSP/adquirente;
- incidente com página/script de checkout aciona contenção, preservação de evidência e notificação contratual específica, além do runbook LGPD quando houver dados pessoais.

### Fiscal, contábil, comissão e documento fiscal

Antes da operação, contador e jurídico tributário devem validar CNPJ, regime, município, código de serviço, natureza da intermediação e obrigações de cada vendedor. O [Portal Nacional da NFS-e](https://www.gov.br/nfse/pt-br) é referência operacional, mas não substitui a análise do ente competente nem define sozinho a tributação do modelo.

- pedido, ledger, settlement e extrato distinguem venda bruta, comissão/serviço Midas, tarifa PSP, desconto/cupom financiado por cada parte, retenção tributária se aplicável, reembolso, chargeback, reserva e líquido ao vendedor;
- Midas emite o documento fiscal relativo à sua própria comissão/serviço quando exigido; a responsabilidade do vendedor pelo documento da venda depende de sua natureza e regime e deve constar do onboarding/contrato;
- emissão “em nome do vendedor” só existe com fundamento, mandato e integração aprovados; ausência de documento fiscal não pode ser mascarada como simples recibo da plataforma;
- cada documento guarda chave/identificador, competência, valor, status, cancelamento/substituição e vínculo ao pedido/lote de payout;
- conciliação diária compara PSP, ledger, documentos fiscais, comissão, estornos e conta bancária; divergência material bloqueia somente o payout relacionado e abre caso com owner;
- contabilidade define plano de contas, reconhecimento de receita da comissão versus valores de terceiros, fechamento mensal e retenção documental; regras fiscais não serão codificadas antes desse parecer.

## 8. Identity e autenticação

- Passkeys/WebAuthn como preferência, conforme [W3C WebAuthn](https://www.w3.org/TR/webauthn-3/).
- Passkey obrigatória para Master/admin financeiro/segurança, salvo break-glass controlado.
- Senha fallback com Argon2id calibrado.
- TOTP e recovery codes com hash; e-mail não é segundo fator forte.
- Step-up para IAM, mudança de e-mail/MFA, destino/saque, reembolso, segredo e exportação.
- Recuperação invalida sessões e aplica cooling-off financeiro.
- Cookie opaco `HttpOnly`, `Secure`, `SameSite`, escopo mínimo.
- CSRF em mutações; rotação após login, step-up e mudança de privilégio.
- Sem token duradouro em `localStorage`.
- Tela de sessões/dispositivos e revogação remota.
- Práticas alinhadas à [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## 9. API própria de dispositivo confiável

### O que ela prova

Confiança de vínculo e contexto de risco; não identidade física, idade ou unicidade universal.

```http
POST   /v1/devices/enrollment-options
POST   /v1/devices/enrollments
GET    /v1/me/devices
PATCH  /v1/me/devices/{deviceId}
DELETE /v1/me/devices/{deviceId}
POST   /v1/devices/{deviceId}/challenge
POST   /v1/devices/{deviceId}/challenge-verification
POST   /internal/v1/risk/evaluations
```

### Controles

- nonce de uso único;
- validação de challenge, RP ID, origem, assinatura e contador;
- guardar chave pública/credential ID, nunca chave privada;
- sinais auxiliares minimizados: ASN, IP truncado, UA family, timezone, idade do vínculo, falhas e velocidade;
- sem fingerprint cross-site;
- retenção curta e acesso RBAC;
- cliente recebe tier/ação, não score ou regra explorável;
- decisão pode ser contestada.

O [Decreto 8.771/2016](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8771.htm) inclui identificadores eletrônicos no conceito relevante de dados pessoais.

## 10. IAM — RBAC + ABAC

Papéis são templates; autorização real combina permissão, objeto e condição.

Condições ABAC:

- ownership;
- canal P2P/Midas;
- departamento;
- categoria/faixa de valor;
- risco/país/horário;
- step-up recente;
- conflito de interesse;
- dupla aprovação.

Regras:

- deny by default e deny explícito vence;
- ninguém concede o que não possui;
- Master não edita ledger, senha, token ou auditoria;
- reembolso, hold manual, payout, destino e privilégio usam segregação;
- toda policy/grant registra diff, motivo, versão e sessão;
- acesso ao audit log também é auditado;
- break-glass é curto, dual-control, alertado e revisado.

## 11. Chat anti-PII e devido processo

### Políticas por sala

- `PRE_PURCHASE`: bloqueia telefone, e-mail, URL, Pix, WhatsApp, Instagram, nick e codificação.
- `DELIVERY`: somente após `payment.settled`; permite o necessário à entrega conforme política.
- `SUPPORT`: PII acessível apenas por agentes autorizados.

### Decisão

```text
mensagem
 -> autenticação + participante
 -> rate limit
 -> Unicode NFKC
 -> remover zero-width / tratar confusables
 -> regras de e-mail, telefone, URL, Pix, social, nick e leetspeak
 -> classificador e confiança
 -> allow | block_no_strike | block_strike | restrict_review
```

- alta confiança: bloqueia e contabiliza;
- média: bloqueia sem strike e permite edição/contestação;
- baixa: aceita; amostragem somente redigida e governada;
- 1º/2º: aviso contextual;
- 3º dentro de janela configurável: restrição imediata e recurso;
- humano decide ban definitivo.

Persistir conteúdo aceito criptografado. Para bloqueado, preferir razão, versão, confiança e fingerprint HMAC; conteúdo bruto só se indispensável ao recurso, em cofre separado e TTL curto.

## 12. Secure Delivery Vault

Login, senha, token e recuperação nunca entram em chat, ticket, e-mail ou log.

- DEK única por pacote;
- envelope encryption com KMS;
- pacote congelado após pagamento;
- reveal somente ao comprador do pedido, com step-up se risco;
- token curto, `Cache-Control: no-store` e proteção contra indexação;
- auditoria da revelação sem conteúdo secreto;
- notificação ao vendedor;
- expiração e crypto-shredding após conclusão + janela de disputa;
- suporte genérico não vê o segredo;
- screenshots/exportações do admin não contêm plaintext.

**Para Standoff 2, o cofre de credenciais de conta fica desabilitado**, pois a venda/compartilhamento de contas contraria os termos atuais.

## 13. WhatsApp e Instagram

Antes do pagamento: bloqueados pelo anti-PII.

Depois do pagamento:

- mostrar somente se vendedor consentiu e política permitir;
- deep link controlado é suficiente no MVP;
- informar que conversa externa pode reduzir a evidência disponível;
- não coletar agenda/contatos;
- integração de mensagens futura só por API oficial e permissões adequadas;
- nunca automatizar acesso, scraping ou login de terceiros.

## 14. Caixa de e-mail e tickets

“Caixa própria” significa uma experiência Midas apoiada em provedor, não construir MTA do zero.

- endereço no domínio Midas;
- inbound webhook validado sobre raw body com assinatura, timestamp e ID de evento; usar mTLS/allowlist de origem quando o provedor oferecer e buscar a mensagem canônica pela API antes de qualquer mutação sensível;
- janela curta de aceitação, cache anti-replay e unicidade de `providerMessageId`/evento; retries repetem a mesma resposta e produzem um único efeito;
- validar envelope sender, destinatário/alias, `From`, `Reply-To` e associação ao ticket; SPF/DKIM/DMARC são sinais contra spoofing, não autorização suficiente para vincular usuário ou pedido;
- `Reply-To` com token opaco, escopo de tenant/ticket/thread e destinatário, expiração curta e hash em repouso; rotacionar após uso, mudança de participante ou incidente e invalidar tokens anteriores;
- HTML sanitizado e imagens remotas bloqueadas;
- anexos em quarentena, MIME real, limite e antivírus;
- SPF, DKIM e DMARC;
- bounce/complaint e lista de supressão;
- remover histórico citado, assinatura e cabeçalhos encaminhados antes de publicar a resposta no ticket; mensagem encaminhada pode vazar cadeia completa, anexos, e-mails, tokens e dados de terceiros;
- detectar e redigir segredos/PII em assunto, corpo, histórico e nome de anexo; URL de ação autenticada nunca é reenviada na citação;
- resposta vinda de endereço diferente, encaminhamento, alias desconhecido ou token expirado entra em quarentena/revisão, sem revelar se pedido, usuário ou ticket existe;
- nota interna separada da resposta;
- ticket pode vincular pedido, anúncio, disputa e usuário;
- SLA, fila, responsável e escalonamento;
- segredo nunca em assunto/notificação/e-mail.

## 15. Classificação de dados

```text
PUBLIC
INTERNAL
CONFIDENTIAL
RESTRICTED_PII
SECRET_AUTH
SECRET_DELIVERY
FINANCIAL
```

Cada schema/evento define classificação. Logs são allowlist por campo, não redaction improvisada. A [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) orienta excluir token, senha, chave e PII sensível.

## 16. Controles de aplicação e infraestrutura

- TLS, HSTS e CSP estrita.
- Output encoding e sanitização.
- BOLA/BFLA testados em toda API, conforme [OWASP API Security](https://owasp.org/www-project-api-security/).
- Queries parametrizadas.
- Rate limit por conta, dispositivo, IP e fluxo.
- Banco/cache/broker em rede privada.
- Workload identity e egress allowlist.
- Field-level encryption para TOTP, contato, PII crítica e cofre.
- Secrets Manager; nada no repositório.
- Upload por URL assinada, re-encode e remoção de EXIF.
- SBOM, lockfile, SAST, SCA, secret scan, DAST e artefato assinado.
- Branch protegida e dupla revisão em auth/finance.
- Baseline [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/).
- Telemetria vendor-neutral com [OpenTelemetry](https://opentelemetry.io/docs/).

## 17. Threat model priorizado

| P | Ameaça | Controle | Teste obrigatório |
|---:|---|---|---|
| P0 | webhook forjado/replay credita saldo | assinatura raw, janela, inbox única, consulta canônica, ledger | 100 repetições = um efeito |
| P0 | corrida vende item duas vezes | lock + índice/reserva única | 100 checkouts = um vencedor |
| P0 | saque duplicado | lotes bloqueados + idempotência PSP | retries/timeouts sem duplicar |
| P0 | IDOR/BOLA | ownership + PDP central | buyer/seller/admin/estranho |
| P0 | abuso administrativo | SoD, step-up, deny e audit | autor não aprova própria ação |
| P0 | vazamento de credencial | Vault/KMS/no-store/redaction | segredo ausente de todos os sinks |
| P1 | account takeover | passkey, MFA, device risk | mudança crítica exige step-up |
| P1 | XSS em listing/chat/e-mail | texto seguro, sanitização, CSP | corpus de payloads |
| P1 | evasão PII | Unicode/confusables/regras+modelo | corpus adversarial pt-BR |
| P1 | preço manipulado | provenance/outlier/quarantine | pico não vira current quote |
| P1 | SSRF por mídia/URL | sem fetch arbitrário, allowlist | metadados/IP privado inacessíveis |
| P1 | provedor comprometido | schema/limite/estado monotônico | payload inesperado não muta dinheiro |
| P1 | DDoS/bot | WAF, quota, backpressure | carga não derruba checkout |
| P2 | gaming de ranking | dedupe, confiança, circularidade | autoclique não muda exposição |

## 18. Auditoria

Campos:

```text
eventId, occurredAt, actorType/id, actingRole,
sessionIdHash, action, resourceType/id,
authorizationDecisionId, policyVersion,
beforeRedacted, afterRedacted, reasonCode,
requestId, correlationId, ipPrefix, userAgentFamily,
dataClassification
```

- append-only por role de banco;
- storage WORM periódico;
- lote assinado/Merkle root como reforço;
- nasce na mesma transação da ação;
- segredo e conteúdo integral nunca entram;
- exportação é autorizada, redigida, expira e fica auditada.

## 19. Retenção baseline

Valores abaixo são desenho inicial sujeito a DPO/jurídico/contabilidade/contratos:

| Dado | Baseline |
|---|---|
| Registro de acesso à aplicação | 6 meses, conforme Marco Civil art. 15, em ambiente segregado |
| Sessão operacional | timeout + histórico de segurança até 90 dias |
| Sinais brutos de dispositivo/IP | 30 dias, minimizados |
| Perfil derivado de risco | 180 dias após última necessidade |
| Eventos de recomendação | 180 dias; agregados 12 meses se necessários |
| PII bloqueada | plaintext somente se indispensável, cofre até 30 dias; razão pelo prazo de recurso |
| Chat pré-compra | 6–12 meses após encerramento, validar finalidade |
| Chat/evidência de disputa | janela contratual/legal e legal hold |
| Segredo de entrega | crypto-shred após conclusão + disputa, teto sugerido 30 dias |
| Ticket/e-mail | 24 meses após fechamento, salvo obrigação/legal hold |
| Observação de preço | 13 meses bruto; candle conforme licença |
| Ledger do saldo de vendas administrado pelo PSP/pedido/audit financeiro | prazo fiscal/contratual definido por especialista |
| Documento de idade | eliminação imediata após extrair o sinal necessário |
| Registro de incidente relevante | ao menos 5 anos, conforme orientação ANPD |
| Backup operacional | 35 dias; mensal até 12 meses conforme política |

Exclusão de conta anonimiza o dispensável e preserva somente o que possui obrigação/finalidade válida.

## 20. Incidente e continuidade

A [ANPD orienta](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis) comunicar incidentes com risco ou dano relevante à Agência e aos titulares em três dias úteis e manter registros por pelo menos cinco anos.

### Runbook de incidente

1. Detectar e classificar.
2. Preservar evidência sem espalhar PII.
3. Conter sessão, chave, integração ou módulo.
4. Acionar jurídico/DPO/direção/PSP.
5. Avaliar risco/dano e população.
6. Comunicar nos prazos aplicáveis.
7. Corrigir, rotacionar e restaurar.
8. Monitorar fraude/chargeback.
9. Fazer postmortem sem culpa, com owner/prazo.

Fornecedor crítico precisa de SLA de notificação inferior ao prazo regulatório.

### DR

- PITR e WAL contínuo;
- backup diário criptografado e imutável;
- conta/região separada;
- restore mensal;
- simulado trimestral;
- RPO financeiro ≤ 5 min, RTO ≤ 60 min;
- cofre/KMS e runbooks incluídos no teste.

## 21. Operações diárias

### Filas

- anúncios por risco/idade;
- PII/recurso;
- disputa/evidência;
- divergência PSP/ledger;
- hold vencido;
- payout falho/retornado;
- ticket fora de SLA;
- feed stale/lacuna;
- asset sem licença/proveniência;
- dispositivo/ATO.

### Kill switches

Separados para:

- novos anúncios;
- publicação;
- checkout;
- revelação de segredo;
- payout;
- ingestão de preço;
- e-mail outbound;
- recomendação.

Pausar um módulo não deve apagar fila nem corromper pedido.

### Runbooks obrigatórios

1. Webhook atrasado/duplicado/fora de ordem.
2. Divergência de settlement.
3. Reserva presa.
4. Vendedor/comprador não confirma.
5. Disputa e evidência.
6. Chargeback após payout.
7. Segredo revelado indevidamente.
8. ATO/Master perdido.
9. PII falso positivo/recurso.
10. Feed manipulado/stale.
11. Asset retirado por direito autoral.
12. E-mail spoof/bounce/complaint.
13. Incidente LGPD.
14. Restore e continuidade.

## 22. RACI de governança

Legenda: `A` aprova e responde pelo gate; `R` executa; `C` é consultado antes da decisão; `I` é informado. Toda linha precisa de evidência anexada ao gate e suplente nomeado; uma pessoa pode acumular papéis no início, mas a segregação de funções financeira e administrativa continua obrigatória.

| Domínio/gate | Direção | Jurídico | DPO/Privacidade | Fiscal/Contábil | Risk/Fraude | Segurança | Produto/Ops | FinOps |
|---|---|---|---|---|---|---|---|---|
| LIC/DATA/ASSET e NO-GO por jogo | A | R | C | I | C | C | C | I |
| Direitos LGPD, DPA, subprocessadores, transferências e cookies | I | C | A | I | C | R | R | I |
| Age assurance e responsável legal | I | C | A | I | R | C | R | I |
| PSP, split, saldo de vendas administrado pelo PSP, hold e payout | I | C | C | C | R | C | C | A/R |
| Comissão, escrituração, conciliação e documento fiscal | I | C | C | A/R | C | I | R | R |
| Antifraude, chargeback, strikes e revisão | I | C | C | I | A/R | C | R | R |
| Segurança, e-mail inbound, vulnerabilidade e incidente | I | C | C | I | C | A/R | R | C |
| Oferta, suporte, moderação e direitos do consumidor | I | A | C | I | R | C | R | C |

O go-live exige aceite nominal dos `A`, ausência de conflito não mitigado e registro de pendências com prazo. DPO/encarregado mantém o canal de titulares; Fiscal/Contábil fecha classificação e documentos; Risk/Fraude define apetite, métricas, exceções e revisão humana.

## 23. Checklist de lançamento

- [ ] Axlebolt autorizou formalmente comércio, transferência, API, dados e assets.
- [ ] Tipos proibidos, sobretudo contas, permanecem desabilitados.
- [ ] PSP contratado e autorizado, com fluxo de fundos diagramado e UX usando “saldo de vendas administrado pelo PSP”.
- [ ] Termos, privacidade, oferta, arrependimento, disputa e suporte aprovados.
- [ ] Age assurance/ECA Digital, vínculo do responsável, revalidação e contestação implementados conforme análise.
- [ ] Privacy Center cobre acesso, correção, exportação, eliminação, oposição, revogação e revisão automatizada.
- [ ] Data inventory, bases, LIA/RIPD, retenção, controlador/operador, DPAs, subprocessadores e transferências internacionais aprovados.
- [ ] Cookies/analytics inventariados; consentimento e opt-out propagam-se a cliente, servidor e fornecedores.
- [ ] Escopo PCI, fluxo de cartão, SAQ/atestação e responsabilidades com PSP/adquirente confirmados.
- [ ] Comissão, plano de contas, documento fiscal, conciliação e obrigações dos vendedores aprovados por Fiscal/Contábil.
- [ ] Passkey/MFA, IAM, step-up, SoD e audit ativos.
- [ ] Webhook, ledger, conciliação, hold e payout passam testes P0.
- [ ] Vault não vaza segredo.
- [ ] Detector PII tem recurso e revisão humana.
- [ ] E-mail inbound valida assinatura/remetente, expiração/rotação de token, anti-replay, histórico encaminhado e anexos seguros; SPF/DKIM/DMARC ativos.
- [ ] ASVS, pentest, SAST/SCA/DAST e SBOM concluídos.
- [ ] Restore e incidente simulados.
- [ ] RACI aceito por DPO/Privacidade, Fiscal/Contábil, Risk/Fraude e demais owners; suplentes, runbooks e SLAs treinados.
- [ ] Piloto limitado sem divergência crítica.
- [ ] Go-live e rollback aprovados por todos os owners.
