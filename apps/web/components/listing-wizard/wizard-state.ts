/**
 * Núcleo puro do wizard de anúncio (SCR-SEL-004/005/006/007).
 *
 * Regras de casa aplicadas aqui:
 * - dinheiro sempre em minor units string, aritmética em BigInt (nunca Number);
 * - nenhum estado é inventado: o que o servidor não aceita é declarado como
 *   congelado, e o que o servidor não decide é declarado como pendente humano;
 * - o motivo de um bloqueio é sempre nomeado e aponta para o campo exato.
 *
 * Contratos reais usados (apps/api/src/catalog-routes.ts):
 *   POST  /v1/listings              -> cria em DRAFT (modules/catalog createListing)
 *   POST  /v1/listings/:id/publish  -> DRAFT|REVIEW -> PUBLISHED
 *   PATCH /v1/listings/:id          -> priceMinor | quantityAvailable | conditionNotes | changeReason
 */
import { parseBrlMinor } from "@/components/seller-listings/price";
import type { ListingStatus, SellerListing } from "@/components/seller-listings/types";

export type WizardStepId = "item" | "pricing" | "proof" | "delivery" | "publish";

export const WIZARD_STEP_ORDER: readonly WizardStepId[] = [
  "item",
  "pricing",
  "proof",
  "delivery",
  "publish",
];

export type ProofKind =
  | "INVENTORY_CAPTURE"
  | "ACQUISITION_HISTORY"
  | "PUBLIC_INVENTORY_LINK"
  | "PLATFORM_TRANSFER_RECORD";

export type DeliveryMethod = "IN_GAME_TRADE" | "IN_GAME_GIFT";

export const PROOF_KINDS: readonly ProofKind[] = [
  "INVENTORY_CAPTURE",
  "ACQUISITION_HISTORY",
  "PUBLIC_INVENTORY_LINK",
  "PLATFORM_TRANSFER_RECORD",
];

export const DELIVERY_METHODS: readonly DeliveryMethod[] = ["IN_GAME_TRADE", "IN_GAME_GIFT"];

export interface WizardDraft {
  catalogItemId: string;
  publicSlug: string;
  conditionNotes: string;
  quantityAvailable: string;
  priceInput: string;
  listingPlanId: string;
  proofKind: ProofKind | "";
  proofReference: string;
  proofAttested: boolean;
  deliveryMethod: DeliveryMethod | "";
  deliveryWindowHours: string;
  deliveryInstructions: string;
}

export type WizardFieldKey = keyof WizardDraft;

export interface WizardBlocker {
  stepId: WizardStepId;
  fieldKey: WizardFieldKey | null;
  message: string;
}

export interface WizardContext {
  catalogItemIds: readonly string[];
  listingPlanIds: readonly string[];
  /** `null` = o anúncio ainda não existe no servidor. */
  listingStatus: ListingStatus | null;
}

export interface WizardStepState {
  id: WizardStepId;
  position: number;
  title: string;
  summary: string;
  status: "complete" | "pending";
  blockers: readonly WizardBlocker[];
}

export interface WizardEvaluation {
  steps: readonly WizardStepState[];
  blockers: readonly WizardBlocker[];
  publishBlockers: readonly WizardBlocker[];
  canSubmitDraft: boolean;
  canPublish: boolean;
}

const STEP_TITLES: Record<WizardStepId, { title: string; summary: string }> = {
  item: {
    title: "Dados do item",
    summary: "Produto escolhido, endereço público e o que o comprador recebe",
  },
  pricing: {
    title: "Preço",
    summary: "Valor, plano de anúncio e quanto sobra para você",
  },
  proof: {
    title: "Prova de posse",
    summary: "Evidência verificável, revisada por pessoa",
  },
  delivery: {
    title: "Entrega",
    summary: "Método e prazo que você assume ao vender",
  },
  publish: {
    title: "Publicação",
    summary: "Revisar tudo e decidir a publicação",
  },
};

/** Campos que o contrato PATCH /v1/listings/:listingId aceita depois da criação. */
export const EDITABLE_AFTER_CREATION: readonly WizardFieldKey[] = [
  "priceInput",
  "quantityAvailable",
  "conditionNotes",
];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function fieldDomId(key: WizardFieldKey): string {
  return `wizard-${key}`;
}

/** O slug viaja em minúsculas para a API; a validação não pode punir o caixa alto digitado. */
export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

export function stepTitle(stepId: WizardStepId): string {
  return STEP_TITLES[stepId].title;
}

export function createEmptyDraft(): WizardDraft {
  return {
    catalogItemId: "",
    publicSlug: "",
    conditionNotes: "",
    quantityAvailable: "1",
    priceInput: "",
    listingPlanId: "",
    proofKind: "",
    proofReference: "",
    proofAttested: false,
    deliveryMethod: "",
    deliveryWindowHours: "24",
    deliveryInstructions: "",
  };
}

export function isFieldEditable(key: WizardFieldKey, listingStatus: ListingStatus | null): boolean {
  if (listingStatus === null) return true;
  return EDITABLE_AFTER_CREATION.includes(key);
}

// ---------------------------------------------------------------------------
// Dinheiro: minor units string + BigInt. Nenhuma etapa passa por Number.
// ---------------------------------------------------------------------------

const MINOR_PATTERN = /^-?\d+$/;
const RATE_PATTERN = /^\d+(?:\.\d+)?$/;

export function priceInputToMinor(input: string): string | null {
  const parsed = parseBrlMinor(input);
  return parsed === null ? null : String(parsed);
}

/** Multiplica minor units por uma taxa decimal, arredondando meio para cima. */
export function multiplyMinorByRate(amountMinor: string, rate: string): string | null {
  if (!MINOR_PATTERN.test(amountMinor)) return null;
  const normalized = rate.trim();
  if (!RATE_PATTERN.test(normalized)) return null;

  const [whole = "0", fraction = ""] = normalized.split(".");
  const scaled = BigInt(`${whole}${fraction}`);
  const denominator = 10n ** BigInt(fraction.length);
  const product = BigInt(amountMinor) * scaled;
  const rounded = (product * 2n + denominator) / (denominator * 2n);
  return rounded.toString();
}

export function addRates(first: string, second: string): string | null {
  const a = first.trim();
  const b = second.trim();
  if (!RATE_PATTERN.test(a) || !RATE_PATTERN.test(b)) return null;

  const decimals = Math.max(a.split(".")[1]?.length ?? 0, b.split(".")[1]?.length ?? 0);
  const scale = (value: string): bigint => {
    const [whole = "0", fraction = ""] = value.split(".");
    return BigInt(`${whole}${fraction.padEnd(decimals, "0")}`);
  };
  const total = (scale(a) + scale(b)).toString().padStart(decimals + 1, "0");
  if (decimals === 0) return total;
  return `${total.slice(0, total.length - decimals)}.${total.slice(total.length - decimals)}`;
}

export interface FeeBreakdownInput {
  priceMinor: string;
  quantity: number;
  platformFeeRate: string;
  pspFeeRate: string;
}

export interface FeeBreakdown {
  grossMinor: string;
  platformFeeMinor: string;
  pspFeeMinor: string;
  netMinor: string;
  netIfAllUnitsSoldMinor: string;
  effectiveRate: string;
}

export function computeFeeBreakdown(input: FeeBreakdownInput): FeeBreakdown | null {
  if (!MINOR_PATTERN.test(input.priceMinor)) return null;
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return null;

  const platformFeeMinor = multiplyMinorByRate(input.priceMinor, input.platformFeeRate);
  const pspFeeMinor = multiplyMinorByRate(input.priceMinor, input.pspFeeRate);
  const effectiveRate = addRates(input.platformFeeRate, input.pspFeeRate);
  if (platformFeeMinor === null || pspFeeMinor === null || effectiveRate === null) return null;

  const gross = BigInt(input.priceMinor);
  const net = gross - BigInt(platformFeeMinor) - BigInt(pspFeeMinor);
  return {
    grossMinor: gross.toString(),
    platformFeeMinor,
    pspFeeMinor,
    netMinor: net.toString(),
    netIfAllUnitsSoldMinor: (net * BigInt(input.quantity)).toString(),
    effectiveRate,
  };
}

/**
 * Motivos pelos quais o líquido é ESTIMATIVA e não promessa.
 * Cada item aponta uma variável concretamente não resolvida.
 */
export function estimateCaveats(context: {
  listingStatus: ListingStatus | null;
  quantity: number;
}): readonly string[] {
  const caveats = [
    "A tarifa do PSP é aplicada pelo provedor no fechamento financeiro; centavos podem diferir por arredondamento.",
    "Impostos, retenções e eventuais reembolsos não entram neste cálculo: o contrato do catálogo não expõe esses valores.",
  ];
  if (context.listingStatus === null) {
    caveats.push(
      "As taxas só ficam congeladas no snapshot comercial quando o rascunho é criado no servidor.",
    );
  }
  if (context.quantity > 1) {
    caveats.push("O total depende de quantas unidades forem realmente vendidas.");
  }
  return caveats;
}

// ---------------------------------------------------------------------------
// Validação por passo
// ---------------------------------------------------------------------------

function blocker(
  stepId: WizardStepId,
  fieldKey: WizardFieldKey | null,
  message: string,
): WizardBlocker {
  return { stepId, fieldKey, message };
}

export function parseQuantity(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 1 && value <= 10_000 ? value : null;
}

export function parseDeliveryWindowHours(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 1 && value <= 168 ? value : null;
}

function itemBlockers(draft: WizardDraft, context: WizardContext): WizardBlocker[] {
  const found: WizardBlocker[] = [];
  if (!draft.catalogItemId) {
    found.push(blocker("item", "catalogItemId", "Escolha o item do catálogo que será anunciado."));
  } else if (!context.catalogItemIds.includes(draft.catalogItemId)) {
    found.push(
      blocker("item", "catalogItemId", "O item escolhido não está entre os itens retornados pela API."),
    );
  }

  const slug = normalizeSlug(draft.publicSlug);
  if (!slug) {
    found.push(blocker("item", "publicSlug", "Defina o endereço público do anúncio."));
  } else if (!SLUG_PATTERN.test(slug) || slug.length > 200) {
    found.push(
      blocker(
        "item",
        "publicSlug",
        "O endereço aceita apenas letras minúsculas, números e hífens, até 200 caracteres.",
      ),
    );
  }

  const notes = draft.conditionNotes.trim();
  if (!notes) {
    found.push(
      blocker("item", "conditionNotes", "Descreva a condição da unidade e o que o comprador recebe."),
    );
  } else if (notes.length > 5_000) {
    found.push(blocker("item", "conditionNotes", "Reduza a descrição para até 5.000 caracteres."));
  }

  if (parseQuantity(draft.quantityAvailable) === null) {
    found.push(
      blocker("item", "quantityAvailable", "Informe uma quantidade inteira entre 1 e 10.000."),
    );
  }
  return found;
}

function pricingBlockers(draft: WizardDraft, context: WizardContext): WizardBlocker[] {
  const found: WizardBlocker[] = [];
  if (priceInputToMinor(draft.priceInput) === null) {
    found.push(
      blocker("pricing", "priceInput", "Informe um preço maior que zero, por exemplo 1.249,90."),
    );
  }
  if (!draft.listingPlanId) {
    found.push(
      blocker("pricing", "listingPlanId", "Escolha o plano de anúncio que define a comissão."),
    );
  } else if (!context.listingPlanIds.includes(draft.listingPlanId)) {
    found.push(
      blocker(
        "pricing",
        "listingPlanId",
        "O plano escolhido não está ativo na resposta de /v1/catalog/listing-plans.",
      ),
    );
  }
  return found;
}

function proofBlockers(draft: WizardDraft): WizardBlocker[] {
  const found: WizardBlocker[] = [];
  if (!draft.proofKind) {
    found.push(blocker("proof", "proofKind", "Escolha o tipo de evidência que você vai apresentar."));
  }
  const reference = draft.proofReference.trim();
  if (!reference) {
    found.push(
      blocker("proof", "proofReference", "Descreva onde a evidência pode ser conferida por quem revisa."),
    );
  } else if (reference.length > 500) {
    found.push(blocker("proof", "proofReference", "Reduza a referência para até 500 caracteres."));
  }
  if (!draft.proofAttested) {
    found.push(
      blocker("proof", "proofAttested", "Confirme que a unidade está com você e disponível para entrega."),
    );
  }
  return found;
}

function deliveryBlockers(draft: WizardDraft): WizardBlocker[] {
  const found: WizardBlocker[] = [];
  if (!draft.deliveryMethod) {
    found.push(blocker("delivery", "deliveryMethod", "Escolha como a entrega acontece."));
  }
  if (parseDeliveryWindowHours(draft.deliveryWindowHours) === null) {
    found.push(
      blocker("delivery", "deliveryWindowHours", "Informe o prazo assumido em horas, entre 1 e 168."),
    );
  }
  const instructions = draft.deliveryInstructions.trim();
  if (!instructions) {
    found.push(
      blocker("delivery", "deliveryInstructions", "Explique o passo a passo que o comprador vai seguir."),
    );
  } else if (instructions.length > 2_000) {
    found.push(
      blocker("delivery", "deliveryInstructions", "Reduza as instruções para até 2.000 caracteres."),
    );
  }
  return found;
}

export function publishBlockers(
  draft: WizardDraft,
  context: WizardContext,
): readonly WizardBlocker[] {
  const found: WizardBlocker[] = [
    ...itemBlockers(draft, context),
    ...pricingBlockers(draft, context),
    ...proofBlockers(draft),
    ...deliveryBlockers(draft),
  ];

  if (context.listingStatus === null) {
    found.push(
      blocker("publish", null, "O rascunho ainda não foi gravado no servidor. Salve antes de publicar."),
    );
    return found;
  }
  if (context.listingStatus !== "DRAFT" && context.listingStatus !== "REVIEW") {
    found.push(
      blocker(
        "publish",
        null,
        `A API só publica anúncios em rascunho ou revisão. Este está em ${context.listingStatus}.`,
      ),
    );
  }
  return found;
}

export function blockersForStep(
  stepId: WizardStepId,
  draft: WizardDraft,
  context: WizardContext,
): readonly WizardBlocker[] {
  switch (stepId) {
    case "item":
      return itemBlockers(draft, context);
    case "pricing":
      return pricingBlockers(draft, context);
    case "proof":
      return proofBlockers(draft);
    case "delivery":
      return deliveryBlockers(draft);
    case "publish":
      return publishBlockers(draft, context);
  }
}

export function evaluateWizard(draft: WizardDraft, context: WizardContext): WizardEvaluation {
  const steps = WIZARD_STEP_ORDER.map((stepId, index): WizardStepState => {
    const stepBlockers = blockersForStep(stepId, draft, context);
    return {
      id: stepId,
      position: index + 1,
      title: STEP_TITLES[stepId].title,
      summary: STEP_TITLES[stepId].summary,
      status: stepBlockers.length === 0 ? "complete" : "pending",
      blockers: stepBlockers,
    };
  });

  const dataBlockers = [
    ...itemBlockers(draft, context),
    ...pricingBlockers(draft, context),
    ...proofBlockers(draft),
    ...deliveryBlockers(draft),
  ];
  const publish = publishBlockers(draft, context);

  return {
    steps,
    blockers: dataBlockers,
    publishBlockers: publish,
    canSubmitDraft: dataBlockers.length === 0,
    canPublish: publish.length === 0,
  };
}

/** Erro por campo, para ligar em aria-describedby. */
export function fieldErrors(
  blockers: readonly WizardBlocker[],
): Partial<Record<WizardFieldKey, string>> {
  const errors: Partial<Record<WizardFieldKey, string>> = {};
  for (const item of blockers) {
    if (item.fieldKey && errors[item.fieldKey] === undefined) errors[item.fieldKey] = item.message;
  }
  return errors;
}

/**
 * Contrato de props compartilhado pelos passos. Puro: nenhum tipo de React aqui,
 * para o núcleo continuar testável sem DOM.
 */
export interface StepFieldsProps {
  draft: WizardDraft;
  errors: Partial<Record<WizardFieldKey, string>>;
  listingStatus: ListingStatus | null;
  onFieldChange: <K extends WizardFieldKey>(key: K, value: WizardDraft[K]) => void;
}

// ---------------------------------------------------------------------------
// Corpos de requisição
// ---------------------------------------------------------------------------

export interface ListingDeclarations {
  ownershipProof: { kind: ProofKind; reference: string };
  delivery: { method: DeliveryMethod; windowHours: number; instructions: string };
}

export interface CreateListingRequestBody {
  publicSlug: string;
  catalogItemId: string;
  sellerAccountId: string;
  listingPlanId: string;
  priceMinor: string;
  currency: string;
  quantityAvailable: number;
  conditionNotes: string;
  metadata: ListingDeclarations;
}

export function buildCreateListingBody(
  draft: WizardDraft,
  sellerAccountId: string,
  context: WizardContext,
): CreateListingRequestBody | null {
  const evaluation = evaluateWizard(draft, context);
  if (!evaluation.canSubmitDraft) return null;

  const priceMinor = priceInputToMinor(draft.priceInput);
  const quantityAvailable = parseQuantity(draft.quantityAvailable);
  const windowHours = parseDeliveryWindowHours(draft.deliveryWindowHours);
  if (priceMinor === null || quantityAvailable === null || windowHours === null) return null;
  if (!draft.proofKind || !draft.deliveryMethod) return null;

  return {
    publicSlug: normalizeSlug(draft.publicSlug),
    catalogItemId: draft.catalogItemId,
    sellerAccountId,
    listingPlanId: draft.listingPlanId,
    priceMinor,
    currency: "BRL",
    quantityAvailable,
    conditionNotes: draft.conditionNotes.trim(),
    metadata: {
      ownershipProof: { kind: draft.proofKind, reference: draft.proofReference.trim() },
      delivery: {
        method: draft.deliveryMethod,
        windowHours,
        instructions: draft.deliveryInstructions.trim(),
      },
    },
  };
}

export interface UpdateListingRequestBody {
  priceMinor?: string;
  quantityAvailable?: number;
  conditionNotes?: string;
  changeReason?: string;
}

export interface EditableListingSnapshot {
  priceMinor: string;
  quantityAvailable: number;
  conditionNotes: string | null;
}

/** Devolve somente o que mudou. Corpo vazio significa "nada para enviar". */
export function buildUpdateListingBody(
  draft: WizardDraft,
  current: EditableListingSnapshot,
  changeReason: string,
): UpdateListingRequestBody {
  const body: UpdateListingRequestBody = {};
  const priceMinor = priceInputToMinor(draft.priceInput);
  if (priceMinor !== null && priceMinor !== current.priceMinor) body.priceMinor = priceMinor;

  const quantity = parseQuantity(draft.quantityAvailable);
  if (quantity !== null && quantity !== current.quantityAvailable) body.quantityAvailable = quantity;

  const notes = draft.conditionNotes.trim();
  if (notes && notes !== (current.conditionNotes ?? "")) body.conditionNotes = notes;

  if (!hasPendingChanges(body)) return body;
  const reason = changeReason.trim();
  if (reason) body.changeReason = reason.slice(0, 1_000);
  return body;
}

export function hasPendingChanges(body: UpdateListingRequestBody): boolean {
  return (
    body.priceMinor !== undefined
    || body.quantityAvailable !== undefined
    || body.conditionNotes !== undefined
  );
}

// ---------------------------------------------------------------------------
// Leitura de um anúncio real de volta para o rascunho do wizard
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null, key: string): string {
  if (!record) return "";
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readPositiveInteger(record: Record<string, unknown> | null, key: string): string {
  if (!record) return "";
  const value = record[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? String(value) : "";
}

function readProofKind(record: Record<string, unknown> | null): ProofKind | "" {
  const value = readString(record, "kind");
  return PROOF_KINDS.find((kind) => kind === value) ?? "";
}

function readDeliveryMethod(record: Record<string, unknown> | null): DeliveryMethod | "" {
  const value = readString(record, "method");
  return DELIVERY_METHODS.find((method) => method === value) ?? "";
}

export function centsToPriceInput(priceMinor: string): string {
  if (!/^\d+$/.test(priceMinor)) return "";
  const padded = priceMinor.padStart(3, "0");
  const whole = padded.slice(0, padded.length - 2);
  const fraction = padded.slice(padded.length - 2);
  return `${BigInt(whole).toLocaleString("pt-BR")},${fraction}`;
}

export function draftFromListing(listing: SellerListing): WizardDraft {
  const metadata = asRecord(listing.metadata);
  const proof = asRecord(metadata?.["ownershipProof"]);
  const delivery = asRecord(metadata?.["delivery"]);

  return {
    catalogItemId: listing.catalogItemId,
    publicSlug: listing.publicSlug,
    conditionNotes: listing.conditionNotes ?? "",
    quantityAvailable: String(listing.quantityAvailable),
    priceInput: centsToPriceInput(listing.priceMinor),
    listingPlanId: listing.listingPlanId,
    proofKind: readProofKind(proof),
    proofReference: readString(proof, "reference"),
    proofAttested: proof !== null,
    deliveryMethod: readDeliveryMethod(delivery),
    deliveryWindowHours: readPositiveInteger(delivery, "windowHours"),
    deliveryInstructions: readString(delivery, "instructions"),
  };
}

// ---------------------------------------------------------------------------
// Persistência local do rascunho (requisito: nunca perder o trabalho do vendedor)
// ---------------------------------------------------------------------------

export function serializeDraft(draft: WizardDraft): string {
  return JSON.stringify(draft);
}

export function parseStoredDraft(raw: string | null): WizardDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const record = asRecord(parsed);
  if (!record) return null;

  const empty = createEmptyDraft();
  return {
    catalogItemId: readString(record, "catalogItemId"),
    publicSlug: readString(record, "publicSlug"),
    conditionNotes: readString(record, "conditionNotes"),
    quantityAvailable: readString(record, "quantityAvailable") || empty.quantityAvailable,
    priceInput: readString(record, "priceInput"),
    listingPlanId: readString(record, "listingPlanId"),
    proofKind: PROOF_KINDS.find((kind) => kind === record["proofKind"]) ?? "",
    proofReference: readString(record, "proofReference"),
    proofAttested: record["proofAttested"] === true,
    deliveryMethod: DELIVERY_METHODS.find((method) => method === record["deliveryMethod"]) ?? "",
    deliveryWindowHours: readString(record, "deliveryWindowHours") || empty.deliveryWindowHours,
    deliveryInstructions: readString(record, "deliveryInstructions"),
  };
}

export function isDraftDirty(draft: WizardDraft): boolean {
  const empty = createEmptyDraft();
  return (Object.keys(empty) as WizardFieldKey[]).some((key) => draft[key] !== empty[key]);
}

export function draftsDiffer(left: WizardDraft, right: WizardDraft): boolean {
  return (Object.keys(left) as WizardFieldKey[]).some((key) => left[key] !== right[key]);
}

export function draftStorageKey(scope: {
  sellerAccountId?: string | undefined;
  listingId?: string | undefined;
}): string {
  return scope.listingId
    ? `midas.listing-wizard.edit.${scope.listingId}`
    : `midas.listing-wizard.new.${scope.sellerAccountId ?? "sem-conta"}`;
}
