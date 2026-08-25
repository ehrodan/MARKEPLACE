# WIRING — `/conta/favoritos` (SCR-ACC-009)

**Agente:** favoritos + watchlist
**Arquivos de propriedade exclusiva deste agente:**

```
apps/web/app/conta/favoritos/page.tsx
apps/web/components/favorites/favorites-view.tsx
apps/web/components/favorites/watch-toggle.tsx
apps/web/components/favorites/favorites-storage.ts
apps/web/components/favorites/favorites.module.css
apps/web/components/favorites/favorites-storage.test.ts
apps/web/components/favorites/favorites-view.test.tsx
docs/coordenacao/WIRING-favoritos.md
```

Nenhum arquivo fora desta lista foi alterado. **Nenhuma rota de API foi criada por este agente**, portanto não há trecho a registrar em `apps/api/src/app.ts`. O que segue é (1) o contrato que a tela consome, (2) a única costura que depende de outro dono e (3) a regra de consentimento que o backend precisa honrar.

---

## 1. Endpoints consumidos pelo front (ainda não publicados pela API)

Enquanto não existirem, a tela opera **100% em modo local** e diz isso em voz alta num `Panel` honesto citando o contrato. Nenhum favorito, preço, contagem ou aviso fictício é exibido em nenhum estado.

| Método | Path | Uso |
|---|---|---|
| `GET` | `/v1/me/watchlist` | Lista da conta. Resposta esperada: `{ data: WatchlistEntry[], asOf?: string, freshness?: "READY" \| "STALE" }`. |
| `POST` | `/v1/me/watchlist` | Upsert de uma entrada (body = `WatchlistEntry`). Chamado ao salvar, ligar ou desligar um aviso. |
| `DELETE` | `/v1/me/watchlist/{listingId}` | Remove a entrada da conta. |
| `GET` | `/v1/listings/{publicSlugOuId}` | **Já existe.** É o que separa `DISPONÍVEL` de `SEM ESTOQUE` e de `FORA DO CATÁLOGO`, item a item. |

### Formas esperadas (fonte: `favorites-storage.ts`)

```ts
type WatchChannel = "PRICE_DROP" | "BACK_IN_STOCK";

interface WatchOptIn {
  channel: WatchChannel;
  optedInAt: string;            // ISO-8601. SEM isto não é opt-in — é descartado na leitura.
  policyVersion: string;        // hoje "watchlist-optin-2026-08"
  targetPriceMinor?: string;    // minor units; só em PRICE_DROP; ausente = qualquer queda
}

interface WatchlistEntry {
  listingId: string;
  publicSlug: string;
  title: string;
  savedPriceMinor: string;      // minor units string, NUNCA number
  currency: string;             // ISO-4217, 3 letras maiúsculas
  savedAt: string;              // ISO-8601
  watch: WatchOptIn[];

  // Campos opcionais que SÓ a projeção da conta consegue afirmar.
  // Sem eles, o front não presume: cai em "Fora do catálogo público".
  state?: "AVAILABLE" | "OUT_OF_STOCK" | "PRICE_CHANGED" | "UNPUBLISHED" | "REMOVED_BY_SELLER";
  stateChangedAt?: string;      // ISO-8601
}
```

**Por que `state` importa.** Lendo só o catálogo público, um `404` em `/v1/listings/{slug}` é ambíguo: pode ser pausa ou remoção definitiva. A tela **se recusa a adivinhar** e mostra `Fora do catálogo público` com essa explicação por extenso. Só `state: "UNPUBLISHED"` (pausado, pode voltar) e `state: "REMOVED_BY_SELLER"` (definitivo, não volta) desfazem a ambiguidade — que é exatamente o propósito da tela no doc 07.

---

## 2. Costura pendente que depende de outro dono: **o botão "Favoritar"**

Hoje **nada no app grava um favorito**. `apps/web/components/listing-detail/purchase-panel.tsx` (dono: outro agente) tem o botão `Favoritar` com `aria-disabled="true"` e a nota honesta de que a capability não existe. Enquanto isso não mudar, `/conta/favoritos` só mostra o estado vazio — que já leva ao `/market` com o motivo.

A costura está pronta e testada do meu lado: `favorites-storage.ts` expõe três funções de **uma chamada cada**, puras, sem React e sem rede. Elas tratam JSON corrompido, storage indisponível e cota estourada internamente — o chamador não precisa saber disso.

```ts
import {
  browserStorage,
  isFavoriteOnDevice,
  removeFavoriteFromDevice,
  saveFavoriteToDevice,
} from "@/components/favorites/favorites-storage";

// Estado inicial do toggle (dentro de useEffect — depende de window):
const saved = isFavoriteOnDevice(browserStorage(), listing.listingId);

// Ao favoritar:
const result = saveFavoriteToDevice(browserStorage(), {
  listingId: listing.listingId,
  publicSlug: listing.publicSlug,
  title: listingTitle(listing),
  savedPriceMinor: listing.priceMinor,   // minor units, direto da resposta da API
  currency: listing.currency,
  savedAt: new Date().toISOString(),
});
// result.issue === "UNAVAILABLE" | "QUOTA" | "TRIMMED" -> avise que não sobrevive ao recarregamento.

// Ao desfavoritar:
removeFavoriteFromDevice(browserStorage(), listing.listingId);
```

Contratos que essas funções garantem, e que o chamador **não deve** reimplementar:

- favoritar **nunca** liga um aviso: a entrada nasce com `watch: []`;
- salvar de novo um item já salvo é **no-op** — não regrava preço, data nem opt-in;
- rascunho fora do formato (preço com `R$`, moeda inválida, data não-ISO) é **recusado**, não gravado pela metade;
- a chave e o formato são os mesmos que `/conta/favoritos` lê, então o item aparece lá na hora.

Quando a API publicar `POST /v1/me/watchlist`, a página do anúncio deve chamar as duas coisas (dispositivo + conta); `/conta/favoritos` já faz o merge dos dois lados ao entrar, sem apagar nenhum deles.

---

## 3. Regra de consentimento que o backend precisa honrar

Os avisos desta tela são **opt-in explícito**, e a política de persuasão da onda é inegociável aqui:

1. **Nada vem pré-marcado.** O estado inicial de todo toggle é desligado. O teste `nenhum aviso vem marcado…` trava isso.
2. **O texto diz o que vai acontecer antes de a pessoa ligar** — canal, gatilho e o fato de a mensagem trazer o preço real e a data real.
3. **Todo opt-in carrega `optedInAt` + `policyVersion`.** Registro sem carimbo é descartado na leitura, nunca ressuscitado como consentimento válido. O backend deve rejeitar igual.
4. **Desligar é um clique** no mesmo botão, e **todo envio** precisa trazer link de descadastro de um clique.
5. **Enquanto a conta não sincroniza, nada é enviado** — e o toggle diz isso, com `StatusBadge` "Ligado só neste dispositivo". Um opt-in que só existe em `localStorage` **não autoriza e-mail nem push**.
6. Um aviso só é oferecido quando ainda pode acontecer: `REMOVIDO PELO VENDEDOR` não oferece nenhum canal novo (só o botão de desligar o que já estava ligado).

Os canais `PRICE_DROP` e `BACK_IN_STOCK` correspondem às finalidades `PRICE_WATCH` e `STOCK_WATCH` já declaradas em `WIRING-notificacoes-preferencias.md`. **Ponto de convergência para o orquestrador:** quando `/v1/me/privacy/preferences` existir, o opt-in feito aqui deve gravar no mesmo ledger de consentimento, com o mesmo `policyVersion`, em vez de virar um segundo registro paralelo. Duas fontes de verdade para consentimento é exatamente o que não aguenta auditoria.

---

## 4. Estados da tela (o propósito do doc 07, por extenso)

Cada estado tem rótulo textual, explicação de uma frase e **ação principal própria** — nunca só cor. Item indisponível **não some** da lista.

| Estado | Origem | Ação principal |
|---|---|---|
| Disponível | catálogo: publicado, com estoque, mesmo preço | Abrir anúncio |
| Preço mudou | catálogo: publicado, preço ≠ preço salvo | Conferir o preço atual |
| Sem estoque | catálogo: `quantityAvailable === 0` | Abrir anúncio esgotado (+ avisar quando voltar) |
| Despublicado pelo vendedor | conta: `state: "UNPUBLISHED"` | Ver ofertas equivalentes (+ avisar quando voltar) |
| Fora do catálogo público | catálogo: `404` **e** sem `state` da conta | Procurar no catálogo público |
| Removido pelo vendedor | conta: `state: "REMOVED_BY_SELLER"` | Procurar substituto no catálogo |
| Não verificado | falha de rede na verificação | Verificar de novo |
| Verificando | consulta em andamento | — (`aria-busy`) |

---

## 5. Verificação executada

```
apps/web $ npx tsc --noEmit
# limpo nos arquivos deste agente (o único erro do pacote está em
# components/progression/level-ladder.tsx, de outro dono)

apps/web $ npx vitest run --config vitest.config.ts components/favorites
 Test Files  2 passed (2)
      Tests  34 passed (34)
```
