import { and, asc, count, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import type { MidasDatabase } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendOutboxEvent } from "@midas/eventing";
import { AppProblem, createUuidV7, type ActorContext } from "@midas/kernel";
import { assertRetentionActor, ConsentService } from "./consent.js";
import {
  evaluateConsentState,
  isMarketingPurpose,
  REMINDER_SUPPRESSION_MESSAGES,
  REMINDER_SUPPRESSION_REASONS,
  MARKETING_PURPOSES,
  shouldRemind,
  type ReminderChannel,
  type ReminderDecision,
  type ReminderPurpose,
  type ReminderSubjectFact,
  type ReminderSuppressionReason,
} from "./reminder-policy.js";
import {
  notifications,
  reminderDispatches,
  savedCarts,
  type NotificationRow,
  type ReminderDispatchRow,
} from "./schema.js";

/**
 * Fila de lembretes.
 *
 * Nada entra na fila sem passar por `shouldRemind`. Quando a politica recusa, a tentativa
 * AINDA e gravada -- com o motivo nomeado em `suppressedReason`. O historico de recusa e o
 * que prova, em auditoria, que a politica foi aplicada e nao contornada.
 *
 * Todo evento de envio de marketing carrega `requiresUnsubscribeLink: true`: o entregador
 * e obrigado a incluir descadastro de um clique em TODA mensagem.
 */

export const NOTIFICATION_KINDS = [
  "CART_SAVED",
  "CART_REMINDER",
  "PRICE_DROP",
  "BACK_IN_STOCK",
  "ORDER_UPDATE",
  "CONSENT_UPDATED",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * Finalidade de marketing por trás de cada tipo de notificação. `null` significa que o item
 * não é marketing: recibo da própria ação da pessoa ou aviso transacional de pedido -- e
 * esse sempre é escrito, porque suprimi-lo prejudicaria quem já comprou.
 */
export const NOTIFICATION_PURPOSE_BY_KIND: Record<NotificationKind, ReminderPurpose | null> = {
  CART_SAVED: null,
  CART_REMINDER: "CART_RECOVERY",
  PRICE_DROP: "PRICE_WATCH",
  BACK_IN_STOCK: "STOCK_WATCH",
  ORDER_UPDATE: null,
  CONSENT_UPDATED: null,
};

export type EnqueueReminderInput = {
  userId: string;
  purpose: ReminderPurpose;
  channel: ReminderChannel;
  /** Motivo unico do lembrete. O mesmo motivo nunca dispara duas vezes. */
  dedupeKey: string;
  /** Instante em que a mensagem sairia. A janela de silencio e avaliada nele. */
  scheduledFor: Date;
  /** Fuso IANA da pessoa, ex.: "America/Sao_Paulo". */
  userTimeZone: string;
  /** Referencia do assunto (carrinho salvo, anuncio). */
  subjectRef?: string | undefined;
  /** Quando informado, os fatos do carrinho sao lidos do proprio modulo. */
  savedCartId?: string | undefined;
  /**
   * Fatos do assunto declarados por quem chama. Retencao nao le `modules/orders` nem
   * `catalog`, entao o chamador precisa declarar o estado real -- nunca supor.
   */
  subject: ReminderSubjectFact;
};

export type EnqueueReminderResult =
  | { accepted: true; dispatch: ReminderDispatchRow; policyVersion: string }
  | {
      accepted: false;
      reason: ReminderSuppressionReason;
      message: string;
      dispatch: ReminderDispatchRow;
      policyVersion: string;
    };

export type CreateNotificationInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  deepLink?: string | undefined;
  relatedRef?: string | undefined;
};

export class ReminderService {
  private readonly consentService: ConsentService;

  constructor(
    private readonly db: MidasDatabase,
    consentService?: ConsentService,
  ) {
    this.consentService = consentService ?? new ConsentService(db);
  }

  /**
   * Aplica a política e grava a tentativa. Recusa NUNCA é silenciosa: devolve
   * `accepted: false` com motivo nomeado e grava a linha suprimida.
   */
  async enqueue(
    input: EnqueueReminderInput,
    actor: ActorContext,
  ): Promise<EnqueueReminderResult> {
    const subject = await this.resolveSubject(input);
    const consent = await this.consentService.currentConsentFact({
      userId: input.userId,
      channel: input.channel,
      purpose: input.purpose,
    });

    const subjectRef = input.subjectRef ?? input.savedCartId ?? null;
    const [dedupeKeyAlreadyUsed, frequency] = await Promise.all([
      this.isDedupeKeyUsed(input.dedupeKey),
      this.loadFrequencyFacts(input.userId, subjectRef),
    ]);

    const decision: ReminderDecision = shouldRemind({
      sendAt: input.scheduledFor,
      userTimeZone: input.userTimeZone,
      purpose: input.purpose,
      channel: input.channel,
      dedupeKeyAlreadyUsed,
      consent,
      frequency,
      subject,
    });

    const reminderDispatchId = createUuidV7();
    const now = new Date();
    const suppressedReason = decision.allowed ? null : decision.reason;

    await withSerializableTransaction(this.db, async (transaction) => {
      await transaction.insert(reminderDispatches).values({
        reminderDispatchId,
        userId: input.userId,
        purpose: input.purpose,
        channel: input.channel,
        subjectRef,
        scheduledFor: input.scheduledFor,
        sentAt: null,
        suppressedReason,
        dedupeKey: input.dedupeKey,
        createdAt: now,
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: decision.allowed
            ? "retention.reminder.enqueued"
            : "retention.reminder.suppressed",
          schemaVersion: 1,
          aggregateType: "ReminderDispatch",
          aggregateId: reminderDispatchId,
          aggregateVersion: 1,
          occurredAt: now,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: {
            reminderDispatchId,
            userId: input.userId,
            purpose: input.purpose,
            channel: input.channel,
            subjectRef,
            scheduledFor: input.scheduledFor.toISOString(),
            dedupeKey: input.dedupeKey,
            policyVersion: decision.policyVersion,
            suppressedReason,
            requiresUnsubscribeLink: isMarketingPurpose(input.purpose),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: decision.allowed
            ? "retention.reminder.enqueue"
            : "retention.reminder.suppress",
          resourceType: "ReminderDispatch",
          resourceId: reminderDispatchId,
          policyVersion: decision.policyVersion,
          ...(suppressedReason === null ? {} : { reasonCode: suppressedReason }),
          afterRedacted: {
            purpose: input.purpose,
            channel: input.channel,
            subjectRef,
            scheduledFor: input.scheduledFor.toISOString(),
            suppressedReason,
          },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });

    const dispatch = await this.requireById(reminderDispatchId);
    if (decision.allowed) {
      return { accepted: true, dispatch, policyVersion: decision.policyVersion };
    }
    return {
      accepted: false,
      reason: decision.reason,
      message: decision.message,
      dispatch,
      policyVersion: decision.policyVersion,
    };
  }

  /** Confirma a entrega real. Só sai de pendente; nunca reabre o que foi suprimido. */
  async markSent(
    reminderDispatchId: string,
    sentAt: Date,
    actor: ActorContext,
  ): Promise<ReminderDispatchRow> {
    await withSerializableTransaction(this.db, async (transaction) => {
      const [row] = await transaction
        .select()
        .from(reminderDispatches)
        .where(eq(reminderDispatches.reminderDispatchId, reminderDispatchId))
        .for("update");

      if (!row) throw notFound("Lembrete não encontrado.");
      if (row.suppressedReason !== null) {
        throw conflict(
          "REMINDER_DISPATCH_SUPPRESSED",
          "Um lembrete suprimido não pode ser marcado como enviado.",
        );
      }
      if (row.sentAt !== null) return;

      await transaction
        .update(reminderDispatches)
        .set({ sentAt })
        .where(eq(reminderDispatches.reminderDispatchId, reminderDispatchId));

      await appendOutboxEvent(
        transaction,
        {
          eventType: "retention.reminder.sent",
          schemaVersion: 1,
          aggregateType: "ReminderDispatch",
          aggregateId: reminderDispatchId,
          aggregateVersion: 2,
          occurredAt: sentAt,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: {
            reminderDispatchId,
            userId: row.userId,
            purpose: row.purpose,
            channel: row.channel,
            sentAt: sentAt.toISOString(),
            requiresUnsubscribeLink: isMarketingPurpose(row.purpose as ReminderPurpose),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "retention.reminder.send",
          resourceType: "ReminderDispatch",
          resourceId: reminderDispatchId,
          afterRedacted: { sentAt: sentAt.toISOString() },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });

    return this.requireById(reminderDispatchId);
  }

  /**
   * Suprime um lembrete que já estava na fila — por exemplo quando o carrinho foi retomado
   * depois do agendamento. O motivo é sempre nomeado.
   */
  async suppress(
    reminderDispatchId: string,
    reason: ReminderSuppressionReason,
    actor: ActorContext,
  ): Promise<ReminderDispatchRow> {
    if (!(REMINDER_SUPPRESSION_REASONS as readonly string[]).includes(reason)) {
      throw invalid("Motivo de supressão desconhecido.");
    }
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      const [row] = await transaction
        .select()
        .from(reminderDispatches)
        .where(eq(reminderDispatches.reminderDispatchId, reminderDispatchId))
        .for("update");

      if (!row) throw notFound("Lembrete não encontrado.");
      if (row.sentAt !== null) {
        throw conflict(
          "REMINDER_DISPATCH_ALREADY_SENT",
          "Um lembrete já entregue não pode ser suprimido.",
        );
      }
      if (row.suppressedReason !== null) return;

      await transaction
        .update(reminderDispatches)
        .set({ suppressedReason: reason })
        .where(eq(reminderDispatches.reminderDispatchId, reminderDispatchId));

      await appendOutboxEvent(
        transaction,
        {
          eventType: "retention.reminder.suppressed",
          schemaVersion: 1,
          aggregateType: "ReminderDispatch",
          aggregateId: reminderDispatchId,
          aggregateVersion: 2,
          occurredAt: now,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: {
            reminderDispatchId,
            userId: row.userId,
            purpose: row.purpose,
            channel: row.channel,
            suppressedReason: reason,
            message: REMINDER_SUPPRESSION_MESSAGES[reason],
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "retention.reminder.suppress",
          resourceType: "ReminderDispatch",
          resourceId: reminderDispatchId,
          reasonCode: reason,
          afterRedacted: { suppressedReason: reason },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });

    return this.requireById(reminderDispatchId);
  }

  /** Fila real de envio: agendado, ainda não entregue, ainda não suprimido. */
  async listPending(now: Date, limit = 100): Promise<ReminderDispatchRow[]> {
    return this.db
      .select()
      .from(reminderDispatches)
      .where(
        and(
          isNull(reminderDispatches.sentAt),
          isNull(reminderDispatches.suppressedReason),
          lte(reminderDispatches.scheduledFor, now),
        ),
      )
      .orderBy(asc(reminderDispatches.scheduledFor), asc(reminderDispatches.reminderDispatchId))
      .limit(limit);
  }

  // -------------------------------------------------------------------------------------
  // Feed in-app
  // -------------------------------------------------------------------------------------

  /**
   * Escreve no feed que a própria pessoa consulta.
   *
   * Defesa em profundidade: o feed é canal PULL e por isso não exige consentimento de
   * marketing, mas uma revogação explícita registrada para aquela finalidade bloqueia até
   * aqui. A recusa é ruidosa (erro nomeado), nunca silenciosa — assim um caminho que
   * tentasse contornar `enqueue` aparece em vez de vazar mensagem.
   */
  async notify(
    input: CreateNotificationInput,
    actor: ActorContext,
  ): Promise<NotificationRow> {
    const purpose = NOTIFICATION_PURPOSE_BY_KIND[input.kind];
    if (purpose !== null) {
      const consent = await this.consentService.currentConsentFact({
        userId: input.userId,
        channel: "IN_APP",
        purpose,
      });
      if (evaluateConsentState(consent) === "REVOKED") {
        throw conflict(
          "RETENTION_CONSENT_REVOKED",
          REMINDER_SUPPRESSION_MESSAGES.CONSENT_REVOKED,
        );
      }
    }

    const notificationId = createUuidV7();
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      await transaction.insert(notifications).values({
        notificationId,
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        deepLink: input.deepLink ?? null,
        relatedRef: input.relatedRef ?? null,
        readAt: null,
        createdAt: now,
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "retention.notification.created",
          schemaVersion: 1,
          aggregateType: "Notification",
          aggregateId: notificationId,
          aggregateVersion: 1,
          occurredAt: now,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: {
            notificationId,
            userId: input.userId,
            kind: input.kind,
            relatedRef: input.relatedRef ?? null,
          },
        },
        actor,
      );
    });

    const [row] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.notificationId, notificationId))
      .limit(1);
    if (!row) throw notFound("Notificação não encontrada.");
    return row;
  }

  async listNotifications(
    userId: string,
    actor: ActorContext,
    options: { unreadOnly?: boolean | undefined; limit?: number | undefined } = {},
  ): Promise<{ data: NotificationRow[]; unreadCount: number; asOf: Date }> {
    assertRetentionActor(actor, userId);
    const asOf = new Date();
    const conditions = [eq(notifications.userId, userId)];
    if (options.unreadOnly === true) conditions.push(isNull(notifications.readAt));

    const [data, [unread]] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt), desc(notifications.notificationId))
        .limit(options.limit ?? 50),
      this.db
        .select({ value: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    ]);

    return { data, unreadCount: unread?.value ?? 0, asOf };
  }

  async markNotificationRead(
    notificationId: string,
    readAt: Date,
    actor: ActorContext,
  ): Promise<NotificationRow> {
    const [row] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.notificationId, notificationId))
      .limit(1);
    if (!row) throw notFound("Notificação não encontrada.");
    assertRetentionActor(actor, row.userId);
    if (row.readAt !== null) return row;

    await this.db
      .update(notifications)
      .set({ readAt })
      .where(eq(notifications.notificationId, notificationId));

    const [updated] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.notificationId, notificationId))
      .limit(1);
    if (!updated) throw notFound("Notificação não encontrada.");
    return updated;
  }

  // -------------------------------------------------------------------------------------
  // Fatos
  // -------------------------------------------------------------------------------------

  private async resolveSubject(input: EnqueueReminderInput): Promise<ReminderSubjectFact> {
    if (input.savedCartId === undefined) return input.subject;

    const [cart] = await this.db
      .select()
      .from(savedCarts)
      .where(eq(savedCarts.savedCartId, input.savedCartId))
      .limit(1);

    if (!cart) {
      return { ...input.subject, cartRecovered: true, cartItemCount: 0 };
    }
    return {
      ...input.subject,
      cartRecovered: cart.status !== "ACTIVE",
      cartItemCount: cart.itemCount,
    };
  }

  private async isDedupeKeyUsed(dedupeKey: string): Promise<boolean> {
    const [row] = await this.db
      .select({ reminderDispatchId: reminderDispatches.reminderDispatchId })
      .from(reminderDispatches)
      .where(
        and(
          eq(reminderDispatches.dedupeKey, dedupeKey),
          isNull(reminderDispatches.suppressedReason),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  private async loadFrequencyFacts(
    userId: string,
    subjectRef: string | null,
  ): Promise<{
    cartRemindersForThisCart: number;
    cartRemindersTotal: number;
    lastMarketingSentAt: Date | null;
  }> {
    const effectiveInstant = sql<Date>`coalesce(${reminderDispatches.sentAt}, ${reminderDispatches.scheduledFor})`;

    const [[perCart], [total], [latestMarketing]] = await Promise.all([
      subjectRef === null
        ? Promise.resolve([{ value: 0 }])
        : this.db
            .select({ value: count() })
            .from(reminderDispatches)
            .where(
              and(
                eq(reminderDispatches.userId, userId),
                eq(reminderDispatches.purpose, "CART_RECOVERY"),
                eq(reminderDispatches.subjectRef, subjectRef),
                isNull(reminderDispatches.suppressedReason),
              ),
            ),
      this.db
        .select({ value: count() })
        .from(reminderDispatches)
        .where(
          and(
            eq(reminderDispatches.userId, userId),
            eq(reminderDispatches.purpose, "CART_RECOVERY"),
            isNull(reminderDispatches.suppressedReason),
          ),
        ),
      this.db
        .select({ instant: effectiveInstant })
        .from(reminderDispatches)
        .where(
          and(
            eq(reminderDispatches.userId, userId),
            inArray(reminderDispatches.purpose, [...MARKETING_PURPOSES]),
            isNull(reminderDispatches.suppressedReason),
          ),
        )
        .orderBy(sql`${effectiveInstant} desc`)
        .limit(1),
    ]);

    return {
      cartRemindersForThisCart: perCart?.value ?? 0,
      cartRemindersTotal: total?.value ?? 0,
      lastMarketingSentAt: latestMarketing?.instant ?? null,
    };
  }

  async findById(reminderDispatchId: string): Promise<ReminderDispatchRow | null> {
    const [row] = await this.db
      .select()
      .from(reminderDispatches)
      .where(eq(reminderDispatches.reminderDispatchId, reminderDispatchId))
      .limit(1);
    return row ?? null;
  }

  private async requireById(reminderDispatchId: string): Promise<ReminderDispatchRow> {
    const row = await this.findById(reminderDispatchId);
    if (!row) throw notFound("Lembrete não encontrado.");
    return row;
  }
}

function invalid(detail: string): AppProblem {
  return new AppProblem({
    status: 422,
    code: "VALIDATION_ERROR",
    title: "Dados inválidos",
    detail,
  });
}

function conflict(code: string, detail: string): AppProblem {
  return new AppProblem({ status: 409, code, title: "Conflito de negócio", detail });
}

function notFound(detail: string): AppProblem {
  return new AppProblem({
    status: 404,
    code: "REMINDER_DISPATCH_NOT_FOUND",
    title: "Não encontrado",
    detail,
  });
}
