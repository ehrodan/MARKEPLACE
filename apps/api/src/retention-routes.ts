import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { apiProblemSchema } from "@midas/contracts";
import type { AuthenticatedSession } from "@midas/identity";
import { AppProblem, parsePublicId, type ActorContext } from "@midas/kernel";
import { actorContext } from "./http/request-context.js";

/*
 * PORTAS ESTRUTURAIS DO MÓDULO DE RETENÇÃO
 *
 * `apps/api/package.json` pertence a outro agente desta onda, então `@midas/retention` ainda
 * não é dependência declarada e nenhum import de valor pode ser feito daqui. A superfície
 * consumida está declarada abaixo como tipo estrutural, conferida campo a campo e assinatura
 * a assinatura contra `modules/retention/src/{schema,consent,saved-cart-service,
 * watchlist-service,reminder-service}.ts` já publicados em disco.
 *
 * Quando a dependência entrar, trocar estes tipos por
 * `import type { SavedCartService, WatchlistService, ReminderService, ConsentService } from "@midas/retention";`
 * é mecânico: os retornos aqui são o subconjunto mínimo que os serializadores leem, então a
 * linha real do Drizzle continua atribuível.
 * Conferência, divergências e trecho de registro: docs/coordenacao/WIRING-retention.md
 */

/** Vocabulário canônico de `reminder-policy.ts`. */
export type ReminderChannel = "EMAIL" | "PUSH" | "IN_APP";
export type ReminderPurpose = "CART_RECOVERY" | "PRICE_WATCH" | "STOCK_WATCH" | "ORDER_UPDATE";
export type ConsentState = "GRANTED" | "MISSING" | "REVOKED";
/** `WATCHLIST_KINDS` de `watchlist-service.ts`. */
export type WatchlistKind = "PRICE_DROP" | "BACK_IN_STOCK" | "ANY_OFFER";

/*
 * `status` e `kind` são colunas `text`; a linha real do Drizzle os entrega como `string`.
 * Declará-los aqui como união quebraria a atribuição da linha.
 */
export type SavedCartRecord = {
  savedCartId: string;
  sourceCartId: string;
  snapshot: Record<string, unknown>;
  itemCount: number;
  subtotalMinor: bigint;
  currency: string;
  savedAt: Date;
  expiresAt: Date;
  recoveredAt: Date | null;
  status: string;
};

export type WatchlistEntryRecord = {
  watchlistEntryId: string;
  listingId: string;
  catalogItemId: string;
  kind: string;
  targetPriceMinor: bigint | null;
  currency: string;
  referencePriceMinor: bigint;
  createdAt: Date;
  lastNotifiedAt: Date | null;
  status: string;
};

export type NotificationRecord = {
  notificationId: string;
  kind: string;
  title: string;
  body: string;
  deepLink: string | null;
  relatedRef: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/** Espelha `ConsentStatus` de `consent.ts`. */
export type ConsentStatusRecord = {
  channel: ReminderChannel;
  purpose: ReminderPurpose;
  state: ConsentState;
  policyVersion: string | null;
  decidedAt: Date | null;
};

/** Subconjunto de `ReminderConsentRow` que a rota devolve. */
export type ConsentLedgerRecord = {
  granted: boolean;
  policyVersion: string;
  recordedAt: Date;
};

/** Subconjunto de `ListingView` de `@midas/catalog` usado para ancorar a vigilância. */
export type WatchableListingRecord = {
  listingId: string;
  catalogItemId: string;
  priceMinor: bigint;
  currency: string;
};

export type SaveCartSnapshotPortInput = {
  userId: string;
  sourceCartId: string;
  snapshot: Record<string, unknown>;
  itemCount: number;
  subtotalMinor: bigint;
  currency: string;
};

export type WatchPortInput = {
  userId: string;
  listingId: string;
  catalogItemId: string;
  kind: WatchlistKind;
  currency: string;
  referencePriceMinor: bigint;
  targetPriceMinor?: bigint | undefined;
};

export type ConsentTargetPortInput = {
  userId: string;
  channel: ReminderChannel;
  purpose: ReminderPurpose;
  /** Onde a pessoa agiu. Derivado no servidor; nunca aceito do cliente. */
  source: string;
};

export type SavedCartServicePort = {
  saveSnapshot(input: SaveCartSnapshotPortInput, actor: ActorContext): Promise<SavedCartRecord>;
  getActiveForUser(
    userId: string,
    actor: ActorContext,
  ): Promise<{ data: SavedCartRecord[]; asOf: Date }>;
  markRecovered(savedCartId: string, actor: ActorContext): Promise<SavedCartRecord>;
};

export type WatchlistServicePort = {
  watch(input: WatchPortInput, actor: ActorContext): Promise<WatchlistEntryRecord>;
  unwatch(watchlistEntryId: string, actor: ActorContext): Promise<WatchlistEntryRecord>;
  listForUser(
    userId: string,
    actor: ActorContext,
  ): Promise<{ data: WatchlistEntryRecord[]; asOf: Date }>;
};

export type ReminderServicePort = {
  listNotifications(
    userId: string,
    actor: ActorContext,
    options: { unreadOnly?: boolean | undefined; limit?: number | undefined },
  ): Promise<{ data: NotificationRecord[]; unreadCount: number; asOf: Date }>;
  markNotificationRead(
    notificationId: string,
    readAt: Date,
    actor: ActorContext,
  ): Promise<NotificationRecord>;
};

export type ConsentServicePort = {
  grant(input: ConsentTargetPortInput, actor: ActorContext): Promise<ConsentLedgerRecord>;
  revoke(input: ConsentTargetPortInput, actor: ActorContext): Promise<ConsentLedgerRecord>;
  listForUser(
    userId: string,
    actor: ActorContext,
  ): Promise<{ data: ConsentStatusRecord[]; asOf: Date }>;
};

export type WatchableCatalogPort = {
  getPublishedListingByReference(reference: string): Promise<WatchableListingRecord | null>;
};

export type RegisterRetentionRoutesOptions = {
  savedCarts: SavedCartServicePort;
  watchlist: WatchlistServicePort;
  reminders: ReminderServicePort;
  consent: ConsentServicePort;
  catalog: WatchableCatalogPort;
  requireSession(request: FastifyRequest): Promise<AuthenticatedSession>;
  requireCsrf(request: FastifyRequest): void;
};

/** Origem gravada na evidência de consentimento. Constante do servidor. */
const consentSource = "api:PUT /v1/me/reminder-consents";

/**
 * Janela de varredura quando há cursor. O módulo ainda não expõe paginação por keyset;
 * até expor, a rota pagina sobre uma janela limitada e falha de forma nomeada se o cursor
 * já saiu dela, em vez de devolver uma página silenciosamente errada.
 */
const notificationScanLimit = 500;

/** Teto de itens marcados por chamada de read-all, para a rota não virar varredura sem fim. */
const readAllScanLimit = 200;

// ===== Vocabulário =====

const reminderChannelSchema = z.enum(["EMAIL", "PUSH", "IN_APP"]);
const reminderPurposeSchema = z.enum([
  "CART_RECOVERY",
  "PRICE_WATCH",
  "STOCK_WATCH",
  "ORDER_UPDATE",
]);
const watchlistKindSchema = z.enum(["PRICE_DROP", "BACK_IN_STOCK", "ANY_OFFER"]);
const consentStateSchema = z.enum(["GRANTED", "MISSING", "REVOKED"]);

const minorUnitsSchema = z.string().regex(/^\d+$/).min(1).max(18);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);

// ===== Corpos de requisição =====

/*
 * O snapshot é continuidade de exibição — "você parou aqui" — e nunca fonte de verdade de
 * preço. O valor cobrado é sempre relido do catálogo no checkout. Divergência entre o
 * snapshot e o preço vigente é diferença real, a ser mostrada à pessoa e nunca escondida.
 */
const savedCartSnapshotSchema = z.object({
  currency: currencySchema,
  subtotalMinor: minorUnitsSchema,
  items: z
    .array(
      z.object({
        listingId: z.uuid(),
        quantity: z.number().int().min(1).max(1000),
        unitPriceMinor: minorUnitsSchema,
        currency: currencySchema,
      }),
    )
    .min(1)
    .max(100),
});

const saveCartBodySchema = z.object({
  cartId: z.uuid(),
  snapshot: savedCartSnapshotSchema,
});

const createWatchlistEntryBodySchema = z
  .object({
    listingId: z.uuid(),
    kind: watchlistKindSchema,
    targetPriceMinor: minorUnitsSchema.optional(),
  })
  .refine((value) => value.kind === "PRICE_DROP" || value.targetPriceMinor === undefined, {
    path: ["targetPriceMinor"],
    message: "targetPriceMinor só se aplica à vigilância de queda de preço.",
  });

/*
 * `policyVersion` NÃO entra no corpo: quem carimba é o módulo (`CONSENT_POLICY_VERSION`),
 * porque versão de política declarada pelo cliente não é evidência de nada.
 * `reoptIn` é a ação inequívoca de reativação — nunca vem por padrão, nunca é inferida.
 */
const putReminderConsentBodySchema = z.object({
  channel: reminderChannelSchema,
  purpose: reminderPurposeSchema,
  granted: z.boolean(),
  reoptIn: z.literal(true).optional(),
});

// ===== Respostas =====

const savedCartSchema = z.object({
  savedCartId: z.uuid(),
  cartId: z.uuid(),
  snapshot: z.record(z.string(), z.unknown()),
  itemCount: z.number().int().min(0),
  subtotalMinor: z.string(),
  currency: currencySchema,
  status: z.string(),
  savedAt: z.iso.datetime(),
  /** Validade real do snapshot. A pessoa vê quando ele deixa de valer. */
  expiresAt: z.iso.datetime(),
  recoveredAt: z.iso.datetime().nullable(),
});

const savedCartEnvelopeSchema = z.object({
  savedCart: savedCartSchema.nullable(),
  asOf: z.iso.datetime(),
});

const watchlistEntrySchema = z.object({
  watchlistEntryId: z.uuid(),
  listingId: z.uuid(),
  catalogItemId: z.uuid(),
  kind: z.string(),
  targetPriceMinor: z.string().nullable(),
  /** Preço real do anúncio no instante do pedido. Âncora conferível, não retórica. */
  referencePriceMinor: z.string(),
  currency: currencySchema,
  status: z.string(),
  lastNotifiedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

const watchlistListSchema = z.object({
  data: z.array(watchlistEntrySchema),
  nextCursor: z.string().nullable(),
  asOf: z.iso.datetime(),
});

const notificationSchema = z.object({
  notificationId: z.uuid(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  deepLink: z.string().nullable(),
  relatedRef: z.string().nullable(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

const notificationListSchema = z.object({
  data: z.array(notificationSchema),
  /** Contagem real de não lidas da pessoa, vinda do banco. */
  unreadCount: z.number().int().min(0),
  nextCursor: z.string().nullable(),
  asOf: z.iso.datetime(),
});

const notificationReadAllSchema = z.object({
  updatedCount: z.number().int().min(0),
  /** Não lidas que sobraram além do teto desta chamada. Zero significa feed limpo. */
  remaining: z.number().int().min(0),
  asOf: z.iso.datetime(),
});

const reminderConsentSchema = z.object({
  channel: reminderChannelSchema,
  purpose: reminderPurposeSchema,
  /** MISSING = não há registro. Ausência de registro nunca é concessão. */
  state: consentStateSchema,
  granted: z.boolean(),
  policyVersion: z.string().nullable(),
  decidedAt: z.iso.datetime().nullable(),
});

const reminderConsentListSchema = z.object({
  data: z.array(reminderConsentSchema),
  asOf: z.iso.datetime(),
});

// ===== Serializadores =====

function serializeSavedCart(savedCart: SavedCartRecord) {
  return {
    savedCartId: savedCart.savedCartId,
    cartId: savedCart.sourceCartId,
    snapshot: savedCart.snapshot,
    itemCount: savedCart.itemCount,
    subtotalMinor: savedCart.subtotalMinor.toString(),
    currency: savedCart.currency,
    status: savedCart.status,
    savedAt: savedCart.savedAt.toISOString(),
    expiresAt: savedCart.expiresAt.toISOString(),
    recoveredAt: savedCart.recoveredAt?.toISOString() ?? null,
  };
}

function serializeWatchlistEntry(entry: WatchlistEntryRecord) {
  return {
    watchlistEntryId: entry.watchlistEntryId,
    listingId: entry.listingId,
    catalogItemId: entry.catalogItemId,
    kind: entry.kind,
    targetPriceMinor: entry.targetPriceMinor === null ? null : entry.targetPriceMinor.toString(),
    referencePriceMinor: entry.referencePriceMinor.toString(),
    currency: entry.currency,
    status: entry.status,
    lastNotifiedAt: entry.lastNotifiedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

function serializeNotification(notification: NotificationRecord) {
  return {
    notificationId: notification.notificationId,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    deepLink: notification.deepLink,
    relatedRef: notification.relatedRef,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

function serializeConsentStatus(status: ConsentStatusRecord) {
  return {
    channel: status.channel,
    purpose: status.purpose,
    state: status.state,
    granted: status.state === "GRANTED",
    policyVersion: status.policyVersion,
    decidedAt: status.decidedAt?.toISOString() ?? null,
  };
}

/** Par canal/finalidade sem linha no livro-razão: fail-closed, nunca concedido. */
function absentConsentStatus(channel: ReminderChannel, purpose: ReminderPurpose) {
  return {
    channel,
    purpose,
    state: "MISSING" as const,
    granted: false,
    policyVersion: null,
    decidedAt: null,
  };
}

// ===== Guardas e utilitários de rota =====

function notFound(code: string, detail: string): AppProblem {
  return new AppProblem({ status: 404, code, title: "Recurso não encontrado", detail });
}

/**
 * O módulo devolve 403 `RETENTION_ACTOR_MISMATCH` quando o recurso é de outra pessoa. Isso
 * confirmaria a existência do identificador para quem está sondando. Na borda HTTP, recurso
 * alheio e recurso inexistente têm que ser a MESMA resposta: 404.
 */
function maskForeignResource(error: unknown, code: string, detail: string): never {
  if (
    error instanceof AppProblem &&
    (error.code === "RETENTION_ACTOR_MISMATCH" || error.status === 404)
  ) {
    throw notFound(code, detail);
  }
  throw error;
}

/**
 * Paginação por cursor sobre uma lista já ordenada de forma estável pelo módulo.
 * Cursor que não está mais na janela falha de forma nomeada — nunca devolve outra página
 * fingindo ser a pedida.
 */
function sliceByCursor<T>(
  rows: readonly T[],
  identify: (row: T) => string,
  cursor: string | undefined,
  limit: number,
): { page: T[]; nextCursor: string | null } {
  let start = 0;
  if (cursor !== undefined) {
    const index = rows.findIndex((row) => identify(row) === cursor);
    if (index < 0) {
      throw new AppProblem({
        status: 422,
        code: "PAGINATION_CURSOR_STALE",
        title: "Página expirada",
        detail: "O ponto de continuação não existe mais nesta lista. Recarregue do início.",
      });
    }
    start = index + 1;
  }
  const page = rows.slice(start, start + limit);
  const following = rows[start + limit];
  return { page, nextCursor: following === undefined ? null : identify(following) };
}

/** Soma dos itens do snapshot em minor units, para conferir o subtotal declarado. */
function sumSnapshotMinor(
  items: ReadonlyArray<{ quantity: number; unitPriceMinor: string }>,
): bigint {
  return items.reduce(
    (total, item) => total + BigInt(item.unitPriceMinor) * BigInt(item.quantity),
    0n,
  );
}

export function registerRetentionRoutes(
  app: FastifyInstance,
  options: RegisterRetentionRoutesOptions,
): void {
  // ===== CARRINHO SALVO =====
  // Persuasão que aguenta auditoria: o carrinho sobrevive a sessão, dispositivo e login.
  // Nenhuma urgência fabricada, nenhuma contagem regressiva, nenhum estoque inventado.

  app.get(
    "/v1/me/saved-cart",
    {
      schema: {
        operationId: "getCurrentUserSavedCart",
        response: { 200: savedCartEnvelopeSchema, 401: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const result = await options.savedCarts.getActiveForUser(
        parsePublicId("user", session.userId),
        actorContext(request, session),
      );
      // O módulo devolve os ativos do mais recente para o mais antigo; a tela de retomada
      // trata do último carrinho abandonado. Não ter nenhum é estado honesto, não erro.
      const [mostRecent] = result.data;
      return {
        savedCart: mostRecent ? serializeSavedCart(mostRecent) : null,
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.post(
    "/v1/me/saved-cart",
    {
      schema: {
        operationId: "saveCurrentUserCart",
        body: saveCartBodySchema,
        response: {
          200: savedCartSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          409: apiProblemSchema,
          422: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const body = saveCartBodySchema.parse(request.body);

      // O subtotal declarado tem que fechar com os itens enviados. Total que não confere
      // não é salvo: ele viraria preço mentiroso na tela de retomada.
      const declaredSubtotal = BigInt(body.snapshot.subtotalMinor);
      if (sumSnapshotMinor(body.snapshot.items) !== declaredSubtotal) {
        throw new AppProblem({
          status: 422,
          code: "SAVED_CART_SUBTOTAL_MISMATCH",
          title: "Carrinho inconsistente",
          detail: "O subtotal informado não corresponde à soma dos itens do carrinho.",
          fieldErrors: [
            { field: "snapshot.subtotalMinor", message: "Não confere com a soma dos itens." },
          ],
        });
      }
      const foreignCurrency = body.snapshot.items.find(
        (item) => item.currency !== body.snapshot.currency,
      );
      if (foreignCurrency !== undefined) {
        throw new AppProblem({
          status: 422,
          code: "SAVED_CART_CURRENCY_MISMATCH",
          title: "Carrinho inconsistente",
          detail: "Todos os itens do carrinho salvo precisam usar a mesma moeda.",
          fieldErrors: [{ field: "snapshot.items", message: "Moedas divergentes no carrinho." }],
        });
      }

      // Um `sourceCartId` tem no máximo um snapshot ativo: salvar de novo atualiza, não duplica.
      const result = await options.savedCarts.saveSnapshot(
        {
          userId: parsePublicId("user", session.userId),
          sourceCartId: body.cartId,
          snapshot: body.snapshot,
          itemCount: body.snapshot.items.length,
          subtotalMinor: declaredSubtotal,
          currency: body.snapshot.currency,
        },
        actorContext(request, session),
      );
      return serializeSavedCart(result);
    },
  );

  app.post(
    "/v1/me/saved-cart/recover",
    {
      schema: {
        operationId: "recoverCurrentUserSavedCart",
        response: {
          200: savedCartSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const userId = parsePublicId("user", session.userId);
      const actor = actorContext(request, session);
      const active = await options.savedCarts.getActiveForUser(userId, actor);
      const [mostRecent] = active.data;
      if (!mostRecent) {
        throw notFound("SAVED_CART_NOT_FOUND", "Nenhum carrinho salvo ativo para retomar.");
      }
      try {
        return serializeSavedCart(
          await options.savedCarts.markRecovered(mostRecent.savedCartId, actor),
        );
      } catch (error) {
        return maskForeignResource(
          error,
          "SAVED_CART_NOT_FOUND",
          "Nenhum carrinho salvo ativo para retomar.",
        );
      }
    },
  );

  // ===== WATCHLIST: queda de preço e volta ao estoque =====
  // A própria pessoa PEDE o aviso. O preço de referência vem do anúncio real, nunca do
  // cliente — é o que impede um "de R$ X por R$ Y" que nunca foi praticado.

  app.get(
    "/v1/me/watchlist",
    {
      schema: {
        operationId: "listCurrentUserWatchlist",
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(50),
          cursor: z.uuid().optional(),
        }),
        response: { 200: watchlistListSchema, 401: apiProblemSchema, 422: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const query = request.query as { limit: number; cursor?: string | undefined };
      const result = await options.watchlist.listForUser(
        parsePublicId("user", session.userId),
        actorContext(request, session),
      );
      const { page, nextCursor } = sliceByCursor(
        result.data,
        (entry) => entry.watchlistEntryId,
        query.cursor,
        query.limit,
      );
      return {
        data: page.map(serializeWatchlistEntry),
        nextCursor,
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.post(
    "/v1/me/watchlist",
    {
      schema: {
        operationId: "createCurrentUserWatchlistEntry",
        body: createWatchlistEntryBodySchema,
        response: {
          201: watchlistEntrySchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
          422: apiProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const body = createWatchlistEntryBodySchema.parse(request.body);

      // Item de catálogo, moeda e preço de referência são lidos do anúncio publicado.
      // Anúncio inexistente, despublicado ou removido não pode ser vigiado.
      const listing = await options.catalog.getPublishedListingByReference(body.listingId);
      if (!listing) {
        throw notFound("LISTING_NOT_FOUND", "Anúncio não encontrado ou não está publicado.");
      }

      const result = await options.watchlist.watch(
        {
          userId: parsePublicId("user", session.userId),
          listingId: listing.listingId,
          catalogItemId: listing.catalogItemId,
          kind: body.kind,
          currency: listing.currency,
          referencePriceMinor: listing.priceMinor,
          ...(body.targetPriceMinor === undefined
            ? {}
            : { targetPriceMinor: BigInt(body.targetPriceMinor) }),
        },
        actorContext(request, session),
      );
      return reply.status(201).send(serializeWatchlistEntry(result));
    },
  );

  app.delete(
    "/v1/me/watchlist/:watchlistEntryId",
    {
      schema: {
        operationId: "deleteCurrentUserWatchlistEntry",
        params: z.object({ watchlistEntryId: z.uuid() }),
        response: {
          204: z.null(),
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = request.params as { watchlistEntryId: string };
      try {
        await options.watchlist.unwatch(
          params.watchlistEntryId,
          actorContext(request, session),
        );
      } catch (error) {
        // Aviso de outra pessoa e aviso inexistente são a mesma resposta.
        maskForeignResource(
          error,
          "WATCHLIST_ENTRY_NOT_FOUND",
          "Nenhum aviso com este identificador.",
        );
      }
      return reply.status(204).send(null);
    },
  );

  // ===== FEED IN-APP =====
  // Canal PULL: só aparece quando a própria pessoa abre. Não empurra nada para fora.

  app.get(
    "/v1/me/notifications",
    {
      schema: {
        operationId: "listCurrentUserNotifications",
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(50),
          cursor: z.uuid().optional(),
          unread: z.enum(["true", "false"]).optional(),
        }),
        response: { 200: notificationListSchema, 401: apiProblemSchema, 422: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const query = request.query as {
        limit: number;
        cursor?: string | undefined;
        unread?: "true" | "false" | undefined;
      };
      // Sem cursor basta a primeira página mais um, para saber se há continuação.
      const scanLimit = query.cursor === undefined ? query.limit + 1 : notificationScanLimit;
      const result = await options.reminders.listNotifications(
        parsePublicId("user", session.userId),
        actorContext(request, session),
        { unreadOnly: query.unread === "true", limit: scanLimit },
      );
      const { page, nextCursor } = sliceByCursor(
        result.data,
        (notification) => notification.notificationId,
        query.cursor,
        query.limit,
      );
      return {
        data: page.map(serializeNotification),
        unreadCount: result.unreadCount,
        nextCursor,
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.post(
    "/v1/me/notifications/:notificationId/read",
    {
      schema: {
        operationId: "markCurrentUserNotificationRead",
        params: z.object({ notificationId: z.uuid() }),
        response: {
          200: notificationSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = request.params as { notificationId: string };
      try {
        return serializeNotification(
          await options.reminders.markNotificationRead(
            params.notificationId,
            new Date(),
            actorContext(request, session),
          ),
        );
      } catch (error) {
        // Notificação de outra pessoa nunca vaza existência: 404, nunca 403.
        return maskForeignResource(
          error,
          "NOTIFICATION_NOT_FOUND",
          "Nenhuma notificação com este identificador.",
        );
      }
    },
  );

  app.post(
    "/v1/me/notifications/read-all",
    {
      schema: {
        operationId: "markAllCurrentUserNotificationsRead",
        response: {
          200: notificationReadAllSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const userId = parsePublicId("user", session.userId);
      const actor = actorContext(request, session);
      const readAt = new Date();
      const unread = await options.reminders.listNotifications(userId, actor, {
        unreadOnly: true,
        limit: readAllScanLimit,
      });

      // Sequencial de propósito: o módulo ainda não expõe marcação em lote, e disparar
      // centenas de updates concorrentes contra o mesmo usuário não vale a economia.
      let updatedCount = 0;
      for (const notification of unread.data) {
        await options.reminders.markNotificationRead(notification.notificationId, readAt, actor);
        updatedCount += 1;
      }

      // `remaining` é a verdade sobre o que sobrou além do teto desta chamada.
      return {
        updatedCount,
        remaining: Math.max(unread.unreadCount - updatedCount, 0),
        asOf: readAt.toISOString(),
      };
    },
  );

  // ===== CONSENTIMENTO DE LEMBRETES =====
  // Opt-in explícito, carimbado com tempo e versão de política pelo módulo.
  // Nada vem marcado. Ausência de registro é ausência de consentimento.

  app.get(
    "/v1/me/reminder-consents",
    {
      schema: {
        operationId: "listCurrentUserReminderConsents",
        response: { 200: reminderConsentListSchema, 401: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const result = await options.consent.listForUser(
        parsePublicId("user", session.userId),
        actorContext(request, session),
      );
      const stored = new Map(
        result.data.map((status) => [`${status.channel}:${status.purpose}`, status]),
      );
      // Matriz completa canal x finalidade. O par sem linha aparece como MISSING, para a
      // tela nunca precisar adivinhar o que significa "não veio na lista".
      const data = reminderChannelSchema.options.flatMap((channel) =>
        reminderPurposeSchema.options.map((purpose) => {
          const status = stored.get(`${channel}:${purpose}`);
          return status ? serializeConsentStatus(status) : absentConsentStatus(channel, purpose);
        }),
      );
      return { data, asOf: result.asOf.toISOString() };
    },
  );

  app.put(
    "/v1/me/reminder-consents",
    {
      schema: {
        operationId: "setCurrentUserReminderConsent",
        body: putReminderConsentBodySchema,
        response: {
          200: reminderConsentSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          409: apiProblemSchema,
          422: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const body = putReminderConsentBodySchema.parse(request.body);
      const userId = parsePublicId("user", session.userId);
      /*
       * A evidência mínima vem do ActorContext que o repositório já produz: correlationId,
       * sessionId, prefixo de IP minimizado e família de user agent redigida. O módulo grava
       * isso junto da versão de política. Nenhuma captura nova de PII é introduzida aqui.
       */
      const actor = actorContext(request, session);
      const target = {
        userId,
        channel: body.channel,
        purpose: body.purpose,
        source: consentSource,
      };

      if (!body.granted) {
        // Revogar é sempre permitido e imediato. Não exige nada além do pedido.
        const revoked = await options.consent.revoke(target, actor);
        return {
          channel: body.channel,
          purpose: body.purpose,
          state: "REVOKED" as const,
          granted: false,
          policyVersion: revoked.policyVersion,
          decidedAt: revoked.recordedAt.toISOString(),
        };
      }

      // Reconceder o que a pessoa já revogou exige ação inequívoca dela. Um PUT solto,
      // repetido por tela ou por script, não desfaz uma revogação em silêncio.
      if (body.reoptIn !== true) {
        const current = await options.consent.listForUser(userId, actor);
        const previous = current.data.find(
          (status) => status.channel === body.channel && status.purpose === body.purpose,
        );
        if (previous?.state === "REVOKED") {
          throw new AppProblem({
            status: 409,
            code: "CONSENT_REOPTIN_REQUIRED",
            title: "Reativação precisa ser confirmada",
            detail:
              "Você já havia cancelado este lembrete. Confirme a reativação para voltar a recebê-lo.",
          });
        }
      }

      const granted = await options.consent.grant(target, actor);
      return {
        channel: body.channel,
        purpose: body.purpose,
        state: granted.granted ? ("GRANTED" as const) : ("REVOKED" as const),
        granted: granted.granted,
        policyVersion: granted.policyVersion,
        decidedAt: granted.recordedAt.toISOString(),
      };
    },
  );
}
