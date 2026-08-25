import { and, asc, eq, inArray } from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import { catalogItems, listings } from "@midas/catalog";
import type { MidasDatabase, MidasTransaction } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { AppProblem, createUuidV7, type ActorContext } from "@midas/kernel";
import { sellerAccounts } from "@midas/sellers";
import { requireActorUserId } from "./authorization.js";
import { cartLines, carts, type CartLineRow, type CartRow } from "./schema.js";

/* ------------------------------------------------------------------ */
/* Cálculo puro (sem I/O) — coberto por testes unitários               */
/* ------------------------------------------------------------------ */

export type CheckoutLineInput = {
  sellerAccountId: string;
  currency: string;
  unitPriceMinor: bigint;
  quantity: number;
};

export type CheckoutGroupTotals = {
  sellerAccountId: string;
  currency: string;
  lineCount: number;
  itemCount: number;
  subtotalMinor: bigint;
};

export function assertPositiveQuantity(quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new AppProblem({
      status: 422,
      code: "QUANTITY_INVALID",
      title: "Quantidade inválida",
      detail: "A quantidade precisa ser um número inteiro maior que zero.",
      fieldErrors: [{ field: "quantity", message: "Informe um inteiro maior que zero." }],
    });
  }
  return quantity;
}

/** Total da linha em unidades monetárias mínimas (BigInt, sem ponto flutuante). */
export function calculateLineTotalMinor(unitPriceMinor: bigint, quantity: number): bigint {
  assertPositiveQuantity(quantity);
  if (unitPriceMinor < 0n) {
    throw new AppProblem({
      status: 422,
      code: "PRICE_INVALID",
      title: "Preço inválido",
      detail: "O preço unitário não pode ser negativo.",
    });
  }
  return unitPriceMinor * BigInt(quantity);
}

/**
 * Agrupa as linhas por conta vendedora (um grupo = um pedido no checkout),
 * preservando a ordem de aparição e somando o subtotal em BigInt.
 */
export function groupCheckoutTotals(lines: readonly CheckoutLineInput[]): CheckoutGroupTotals[] {
  const groups = new Map<string, CheckoutGroupTotals>();
  for (const line of lines) {
    const lineTotal = calculateLineTotalMinor(line.unitPriceMinor, line.quantity);
    const current = groups.get(line.sellerAccountId);
    if (!current) {
      groups.set(line.sellerAccountId, {
        sellerAccountId: line.sellerAccountId,
        currency: line.currency,
        lineCount: 1,
        itemCount: line.quantity,
        subtotalMinor: lineTotal,
      });
      continue;
    }
    if (current.currency !== line.currency) {
      throw new AppProblem({
        status: 409,
        code: "CART_CURRENCY_MISMATCH",
        title: "Moedas divergentes no carrinho",
        detail: "Todas as linhas de um mesmo vendedor precisam usar a mesma moeda.",
      });
    }
    current.lineCount += 1;
    current.itemCount += line.quantity;
    current.subtotalMinor += lineTotal;
  }
  return [...groups.values()];
}

export function sumSubtotalMinor(groups: readonly CheckoutGroupTotals[]): bigint {
  return groups.reduce((total, group) => total + group.subtotalMinor, 0n);
}

/**
 * Comissão da plataforma a partir de uma taxa decimal exata (ex.: "0.0750").
 * Aritmética inteira com arredondamento half-up — nunca Number.
 */
export function calculateFeeMinor(subtotalMinor: bigint, feeRate: string): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(feeRate.trim());
  if (!match) {
    throw feeRateInvalid("A taxa comercial do anúncio não está em formato decimal utilizável.");
  }
  const integerPart = match[1] ?? "0";
  const fractionPart = match[2] ?? "";
  const scaled = BigInt(`${integerPart}${fractionPart}`);
  const denominator = 10n ** BigInt(fractionPart.length);
  if (scaled > denominator) {
    throw feeRateInvalid("A taxa comercial do anúncio não pode ultrapassar 100%.");
  }
  if (subtotalMinor < 0n) {
    throw feeRateInvalid("O subtotal do pedido não pode ser negativo.");
  }
  return (subtotalMinor * scaled * 2n + denominator) / (denominator * 2n);
}

function feeRateInvalid(detail: string): AppProblem {
  return new AppProblem({
    status: 500,
    code: "ORDER_FEE_RATE_INVALID",
    title: "Taxa comercial inválida",
    detail,
  });
}

/* ------------------------------------------------------------------ */
/* Serviço                                                             */
/* ------------------------------------------------------------------ */

export type GuestCartLineInput = {
  listingId: string;
  quantity: number;
};

export type CartLineView = CartLineRow & {
  lineTotalMinor: bigint;
  currentPriceMinor: bigint;
  priceChanged: boolean;
  quantityAvailable: number;
  purchasable: boolean;
  listing: {
    listingId: string;
    publicSlug: string;
    listingStatus: string;
    catalogItemId: string;
  };
  catalogItem: {
    catalogItemId: string;
    publicSlug: string;
    displayName: string;
    gameOrigin: string;
    itemType: string;
  };
};

export type CartCheckoutGroup = {
  sellerAccountId: string;
  sellerDisplayName: string;
  currency: string;
  itemCount: number;
  subtotalMinor: bigint;
  lines: CartLineView[];
};

export type CartView = {
  cart: CartRow;
  lines: CartLineView[];
  groups: CartCheckoutGroup[];
  currency: string | null;
  itemCount: number;
  subtotalMinor: bigint;
  asOf: Date;
};

export type CartMergeResult = CartView & {
  skipped: Array<{ listingId: string; reasonCode: string }>;
};

export type PurchasableListing = {
  listingId: string;
  publicSlug: string;
  listingStatus: string;
  sellerAccountId: string;
  catalogItemId: string;
  listingPlanId: string;
  priceMinor: bigint;
  currency: string;
  quantityAvailable: number;
};

export class CartService {
  constructor(private readonly db: MidasDatabase) {}

  async getOrCreateCart(actor: ActorContext): Promise<CartView> {
    const userId = requireActorUserId(actor);
    const cartId = await withSerializableTransaction(this.db, async (transaction) => {
      const cart = await ensureActiveCart(transaction, userId);
      return cart.cartId;
    });
    return this.buildCartView(cartId);
  }

  async addLine(
    input: { listingId: string; quantity: number },
    actor: ActorContext,
  ): Promise<CartView> {
    const quantity = assertPositiveQuantity(input.quantity);
    const userId = requireActorUserId(actor);

    const cartId = await withSerializableTransaction(this.db, async (transaction) => {
      const cart = await ensureActiveCart(transaction, userId);
      const listing = await requirePurchasableListing(transaction, input.listingId);
      await applyLineQuantity(transaction, cart, listing, quantity, "ADD");
      await appendAuditEvent(
        transaction,
        {
          action: "orders.cart.line_add",
          resourceType: "Cart",
          resourceId: cart.cartId,
          sellerAccountId: listing.sellerAccountId,
          afterRedacted: {
            listingId: listing.listingId,
            quantity,
            unitPriceMinor: listing.priceMinor.toString(),
            currency: listing.currency,
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );
      return cart.cartId;
    });

    return this.buildCartView(cartId);
  }

  async updateLineQuantity(
    input: { cartLineId: string; quantity: number },
    actor: ActorContext,
  ): Promise<CartView> {
    const quantity = assertPositiveQuantity(input.quantity);
    const userId = requireActorUserId(actor);

    const cartId = await withSerializableTransaction(this.db, async (transaction) => {
      const cart = await ensureActiveCart(transaction, userId);
      const [line] = await transaction
        .select()
        .from(cartLines)
        .where(and(eq(cartLines.cartLineId, input.cartLineId), eq(cartLines.cartId, cart.cartId)))
        .for("update");
      if (!line) throw cartLineNotFound();

      const listing = await requirePurchasableListing(transaction, line.listingId);
      await applyLineQuantity(transaction, cart, listing, quantity, "SET");
      await appendAuditEvent(
        transaction,
        {
          action: "orders.cart.line_update",
          resourceType: "Cart",
          resourceId: cart.cartId,
          sellerAccountId: listing.sellerAccountId,
          beforeRedacted: { cartLineId: line.cartLineId, quantity: line.quantity },
          afterRedacted: { cartLineId: line.cartLineId, quantity },
          dataClassification: "INTERNAL",
        },
        actor,
      );
      return cart.cartId;
    });

    return this.buildCartView(cartId);
  }

  async removeLine(cartLineId: string, actor: ActorContext): Promise<CartView> {
    const userId = requireActorUserId(actor);

    const cartId = await withSerializableTransaction(this.db, async (transaction) => {
      const cart = await ensureActiveCart(transaction, userId);
      const [line] = await transaction
        .select()
        .from(cartLines)
        .where(and(eq(cartLines.cartLineId, cartLineId), eq(cartLines.cartId, cart.cartId)))
        .for("update");
      if (!line) throw cartLineNotFound();

      await transaction.delete(cartLines).where(eq(cartLines.cartLineId, cartLineId));
      await touchCart(transaction, cart);
      await appendAuditEvent(
        transaction,
        {
          action: "orders.cart.line_remove",
          resourceType: "Cart",
          resourceId: cart.cartId,
          sellerAccountId: line.sellerAccountId,
          beforeRedacted: { cartLineId: line.cartLineId, quantity: line.quantity },
          dataClassification: "INTERNAL",
        },
        actor,
      );
      return cart.cartId;
    });

    return this.buildCartView(cartId);
  }

  /**
   * Funde o carrinho local do visitante no carrinho do servidor após o login.
   * Linha indisponível agora não derruba o merge: entra em `skipped` com o motivo.
   */
  async mergeGuestLines(
    input: { lines: readonly GuestCartLineInput[] },
    actor: ActorContext,
  ): Promise<CartMergeResult> {
    const userId = requireActorUserId(actor);
    const skipped: Array<{ listingId: string; reasonCode: string }> = [];

    const cartId = await withSerializableTransaction(this.db, async (transaction) => {
      const cart = await ensureActiveCart(transaction, userId);
      let mergedLines = 0;
      skipped.length = 0;

      for (const guestLine of input.lines) {
        const quantity = assertPositiveQuantity(guestLine.quantity);
        try {
          const listing = await requirePurchasableListing(transaction, guestLine.listingId);
          await applyLineQuantity(transaction, cart, listing, quantity, "ADD");
          mergedLines += 1;
        } catch (error) {
          if (error instanceof AppProblem && error.status === 409) {
            skipped.push({ listingId: guestLine.listingId, reasonCode: error.code });
            continue;
          }
          throw error;
        }
      }

      await appendAuditEvent(
        transaction,
        {
          action: "orders.cart.merge",
          resourceType: "Cart",
          resourceId: cart.cartId,
          afterRedacted: {
            requestedLines: input.lines.length,
            mergedLines,
            skippedLines: skipped.length,
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );
      return cart.cartId;
    });

    const view = await this.buildCartView(cartId);
    return { ...view, skipped };
  }

  /** Grupos de checkout (um pedido por vendedor) com subtotal por grupo. */
  async listCheckoutGroups(
    actor: ActorContext,
  ): Promise<{ data: CartCheckoutGroup[]; asOf: Date }> {
    const view = await this.getOrCreateCart(actor);
    return { data: view.groups, asOf: view.asOf };
  }

  private async buildCartView(cartId: string): Promise<CartView> {
    const asOf = new Date();
    const [cart] = await this.db.select().from(carts).where(eq(carts.cartId, cartId)).limit(1);
    if (!cart) throw cartNotFound();

    const lines = await this.db
      .select()
      .from(cartLines)
      .where(eq(cartLines.cartId, cartId))
      .orderBy(asc(cartLines.addedAt), asc(cartLines.cartLineId));

    if (lines.length === 0) {
      return {
        cart,
        lines: [],
        groups: [],
        currency: cart.currency,
        itemCount: 0,
        subtotalMinor: 0n,
        asOf,
      };
    }

    const listingIds = [...new Set(lines.map((line) => line.listingId))];
    const sellerAccountIds = [...new Set(lines.map((line) => line.sellerAccountId))];

    const [listingRows, sellerRows] = await Promise.all([
      this.db
        .select({
          listingId: listings.listingId,
          publicSlug: listings.publicSlug,
          listingStatus: listings.listingStatus,
          priceMinor: listings.priceMinor,
          quantityAvailable: listings.quantityAvailable,
          catalogItemId: listings.catalogItemId,
          catalogItemSlug: catalogItems.publicSlug,
          catalogItemName: catalogItems.displayName,
          gameOrigin: catalogItems.gameOrigin,
          itemType: catalogItems.itemType,
        })
        .from(listings)
        .innerJoin(catalogItems, eq(catalogItems.catalogItemId, listings.catalogItemId))
        .where(inArray(listings.listingId, listingIds)),
      this.db
        .select({
          sellerAccountId: sellerAccounts.sellerAccountId,
          displayName: sellerAccounts.displayName,
        })
        .from(sellerAccounts)
        .where(inArray(sellerAccounts.sellerAccountId, sellerAccountIds)),
    ]);

    const listingById = new Map(listingRows.map((row) => [row.listingId, row]));
    const sellerById = new Map(sellerRows.map((row) => [row.sellerAccountId, row]));

    const lineViews: CartLineView[] = [];
    for (const line of lines) {
      const listing = listingById.get(line.listingId);
      if (!listing) {
        throw new AppProblem({
          status: 500,
          code: "CART_LINE_LISTING_MISSING",
          title: "Carrinho inconsistente",
          detail: "Uma linha do carrinho aponta para um anúncio indisponível.",
        });
      }
      lineViews.push({
        ...line,
        lineTotalMinor: calculateLineTotalMinor(line.unitPriceMinor, line.quantity),
        currentPriceMinor: listing.priceMinor,
        priceChanged: listing.priceMinor !== line.unitPriceMinor,
        quantityAvailable: listing.quantityAvailable,
        purchasable:
          listing.listingStatus === "PUBLISHED" && listing.quantityAvailable >= line.quantity,
        listing: {
          listingId: listing.listingId,
          publicSlug: listing.publicSlug,
          listingStatus: listing.listingStatus,
          catalogItemId: listing.catalogItemId,
        },
        catalogItem: {
          catalogItemId: listing.catalogItemId,
          publicSlug: listing.catalogItemSlug,
          displayName: listing.catalogItemName,
          gameOrigin: listing.gameOrigin,
          itemType: listing.itemType,
        },
      });
    }

    const totals = groupCheckoutTotals(lineViews);
    const groups: CartCheckoutGroup[] = totals.map((total) => ({
      sellerAccountId: total.sellerAccountId,
      sellerDisplayName: sellerById.get(total.sellerAccountId)?.displayName ?? "",
      currency: total.currency,
      itemCount: total.itemCount,
      subtotalMinor: total.subtotalMinor,
      lines: lineViews.filter((line) => line.sellerAccountId === total.sellerAccountId),
    }));

    return {
      cart,
      lines: lineViews,
      groups,
      currency: cart.currency,
      itemCount: totals.reduce((count, group) => count + group.itemCount, 0),
      subtotalMinor: sumSubtotalMinor(totals),
      asOf,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Internos                                                            */
/* ------------------------------------------------------------------ */

export async function ensureActiveCart(
  transaction: MidasTransaction,
  userId: string,
): Promise<CartRow> {
  const [existing] = await transaction
    .select()
    .from(carts)
    .where(and(eq(carts.userId, userId), eq(carts.status, "ACTIVE")))
    .for("update");
  if (existing) return existing;

  const cartId = createUuidV7();
  const now = new Date();
  await transaction.insert(carts).values({
    cartId,
    userId,
    status: "ACTIVE",
    currency: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await transaction.select().from(carts).where(eq(carts.cartId, cartId)).limit(1);
  if (!created) throw cartNotFound();
  return created;
}

/** Revalida o anúncio agora: precisa estar publicado, vivo e com o preço corrente. */
export async function requirePurchasableListing(
  transaction: MidasTransaction,
  listingId: string,
  lockForUpdate = false,
): Promise<PurchasableListing> {
  const query = transaction
    .select({
      listingId: listings.listingId,
      publicSlug: listings.publicSlug,
      listingStatus: listings.listingStatus,
      sellerAccountId: listings.sellerAccountId,
      catalogItemId: listings.catalogItemId,
      listingPlanId: listings.listingPlanId,
      priceMinor: listings.priceMinor,
      currency: listings.currency,
      quantityAvailable: listings.quantityAvailable,
      tombstonedAt: listings.tombstonedAt,
    })
    .from(listings)
    .where(eq(listings.listingId, listingId))
    .limit(1);

  const [listing] = lockForUpdate ? await query.for("update") : await query;

  if (!listing || listing.tombstonedAt !== null || listing.listingStatus !== "PUBLISHED") {
    throw new AppProblem({
      status: 409,
      code: "LISTING_NOT_AVAILABLE",
      title: "Anúncio indisponível",
      detail: "O anúncio não está publicado no momento.",
    });
  }

  return {
    listingId: listing.listingId,
    publicSlug: listing.publicSlug,
    listingStatus: listing.listingStatus,
    sellerAccountId: listing.sellerAccountId,
    catalogItemId: listing.catalogItemId,
    listingPlanId: listing.listingPlanId,
    priceMinor: listing.priceMinor,
    currency: listing.currency,
    quantityAvailable: listing.quantityAvailable,
  };
}

async function applyLineQuantity(
  transaction: MidasTransaction,
  cart: CartRow,
  listing: PurchasableListing,
  quantity: number,
  mode: "ADD" | "SET",
): Promise<void> {
  if (cart.currency !== null && cart.currency !== listing.currency) {
    throw new AppProblem({
      status: 409,
      code: "CART_CURRENCY_MISMATCH",
      title: "Moedas divergentes no carrinho",
      detail: "O carrinho já está em outra moeda. Finalize ou esvazie o carrinho atual.",
    });
  }

  const [existingLine] = await transaction
    .select()
    .from(cartLines)
    .where(and(eq(cartLines.cartId, cart.cartId), eq(cartLines.listingId, listing.listingId)))
    .for("update");

  const desiredQuantity =
    mode === "ADD" && existingLine ? existingLine.quantity + quantity : quantity;
  assertPositiveQuantity(desiredQuantity);

  if (desiredQuantity > listing.quantityAvailable) {
    throw new AppProblem({
      status: 409,
      code: "LISTING_INSUFFICIENT_QUANTITY",
      title: "Quantidade indisponível",
      detail: `O anúncio possui apenas ${String(listing.quantityAvailable)} unidade(s) disponível(is).`,
    });
  }

  const now = new Date();
  if (existingLine) {
    await transaction
      .update(cartLines)
      .set({
        quantity: desiredQuantity,
        unitPriceMinor: listing.priceMinor,
        currency: listing.currency,
        sellerAccountId: listing.sellerAccountId,
        priceAsOf: now,
      })
      .where(eq(cartLines.cartLineId, existingLine.cartLineId));
  } else {
    await transaction.insert(cartLines).values({
      cartLineId: createUuidV7(),
      cartId: cart.cartId,
      listingId: listing.listingId,
      sellerAccountId: listing.sellerAccountId,
      quantity: desiredQuantity,
      unitPriceMinor: listing.priceMinor,
      currency: listing.currency,
      addedAt: now,
      priceAsOf: now,
    });
  }

  await touchCart(transaction, cart, listing.currency);
}

async function touchCart(
  transaction: MidasTransaction,
  cart: CartRow,
  currency?: string,
): Promise<void> {
  const nextVersion = cart.version + 1;
  await transaction
    .update(carts)
    .set({
      ...(currency ? { currency } : {}),
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(carts.cartId, cart.cartId));
  cart.version = nextVersion;
  if (currency) cart.currency = currency;
}

function cartNotFound(): AppProblem {
  return new AppProblem({
    status: 404,
    code: "CART_NOT_FOUND",
    title: "Carrinho não encontrado",
    detail: "O carrinho não existe ou não está disponível para esta sessão.",
  });
}

function cartLineNotFound(): AppProblem {
  return new AppProblem({
    status: 404,
    code: "CART_LINE_NOT_FOUND",
    title: "Item do carrinho não encontrado",
    detail: "A linha informada não pertence ao carrinho ativo desta sessão.",
  });
}
