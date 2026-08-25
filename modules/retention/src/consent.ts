import { and, desc, eq } from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import type { MidasDatabase } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendOutboxEvent } from "@midas/eventing";
import { AppProblem, createUuidV7, type ActorContext } from "@midas/kernel";
import {
  evaluateConsentState,
  requiresExplicitConsent,
  type ConsentState,
  type ReminderChannel,
  type ReminderConsentFact,
  type ReminderPurpose,
} from "./reminder-policy.js";
import { reminderConsents, type ReminderConsentRow } from "./schema.js";

/**
 * Consentimento de lembretes.
 *
 * Regras que este arquivo garante por construcao:
 *  - Nunca ha consentimento por padrao. A ausencia de linha significa NAO.
 *  - Conceder e revogar sao sempre INSERT em livro-razao append-only: nada e sobrescrito,
 *    entao a revogacao fica registrada de forma irreversivel.
 *  - Toda linha carrega `policyVersion` e `evidence` (origem, correlacao, instante).
 *  - Revogar e imediato: a proxima leitura de estado ja devolve REVOKED.
 */

export const CONSENT_POLICY_VERSION = "retention-consent@1.0.0";

export type ConsentEvidenceInput = {
  actor: ActorContext;
  /** Onde a pessoa agiu, ex.: "web:/conta/notificacoes" ou "email:unsubscribe-link". */
  source: string;
  recordedAt: Date;
  extra?: Record<string, unknown> | undefined;
};

/** Monta a evidencia de consentimento. Puro: so transforma o que recebeu. */
export function buildConsentEvidence(input: ConsentEvidenceInput): Record<string, unknown> {
  return {
    source: input.source,
    correlationId: input.actor.correlationId,
    recordedAt: input.recordedAt.toISOString(),
    ...(input.actor.ipPrefix === undefined ? {} : { ipPrefix: input.actor.ipPrefix }),
    ...(input.actor.userAgentFamily === undefined
      ? {}
      : { userAgentFamily: input.actor.userAgentFamily }),
    ...(input.extra ?? {}),
  };
}

/** Converte uma linha do livro-razao no fato consumido pela politica. */
export function toConsentFact(row: ReminderConsentRow | undefined): ReminderConsentFact | null {
  if (row === undefined) return null;
  return {
    granted: row.granted,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    policyVersion: row.policyVersion,
  };
}

/**
 * Guarda de ator do modulo: retencao trata dados pessoais da propria pessoa. Operacoes de
 * usuario so podem ser executadas por ele mesmo. Rotinas de sistema (expiracao, fila de
 * envio, avaliacao de preco) nao passam por aqui e devem ser protegidas por permissao de
 * plataforma na camada de API -- ver docs/coordenacao/WIRING-retention-domain.md.
 */
export function assertRetentionActor(actor: ActorContext, userId: string): string {
  if (!actor.actorUserId) {
    throw new AppProblem({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      title: "Entre para continuar",
      detail: "Uma sessão válida é necessária para acessar seus lembretes.",
    });
  }
  if (actor.actorUserId !== userId) {
    throw new AppProblem({
      status: 403,
      code: "RETENTION_ACTOR_MISMATCH",
      title: "Acesso negado",
      detail: "Só a própria pessoa pode gerenciar seus lembretes e consentimentos.",
    });
  }
  return actor.actorUserId;
}

export type ConsentTarget = {
  userId: string;
  channel: ReminderChannel;
  purpose: ReminderPurpose;
};

export type GrantConsentInput = ConsentTarget & {
  source: string;
  extra?: Record<string, unknown> | undefined;
};

export type RevokeConsentInput = ConsentTarget & {
  source: string;
  extra?: Record<string, unknown> | undefined;
};

export type ConsentStatus = ConsentTarget & {
  state: ConsentState;
  requiresExplicitConsent: boolean;
  policyVersion: string | null;
  decidedAt: Date | null;
};

export class ConsentService {
  constructor(private readonly db: MidasDatabase) {}

  /**
   * Registra o SIM explícito. Nunca chamado por padrão em cadastro: só a partir de uma
   * ação afirmativa da pessoa, com a origem registrada em `source`.
   */
  async grant(input: GrantConsentInput, actor: ActorContext): Promise<ReminderConsentRow> {
    assertRetentionActor(actor, input.userId);
    const reminderConsentId = createUuidV7();
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      await transaction.insert(reminderConsents).values({
        reminderConsentId,
        userId: input.userId,
        channel: input.channel,
        purpose: input.purpose,
        granted: true,
        grantedAt: now,
        revokedAt: null,
        policyVersion: CONSENT_POLICY_VERSION,
        evidence: buildConsentEvidence({
          actor,
          source: input.source,
          recordedAt: now,
          extra: input.extra,
        }),
        recordedAt: now,
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "retention.consent.granted",
          schemaVersion: 1,
          aggregateType: "ReminderConsent",
          aggregateId: reminderConsentId,
          aggregateVersion: 1,
          occurredAt: now,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: {
            reminderConsentId,
            userId: input.userId,
            channel: input.channel,
            purpose: input.purpose,
            policyVersion: CONSENT_POLICY_VERSION,
            grantedAt: now.toISOString(),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "retention.consent.grant",
          resourceType: "ReminderConsent",
          resourceId: reminderConsentId,
          policyVersion: CONSENT_POLICY_VERSION,
          afterRedacted: {
            channel: input.channel,
            purpose: input.purpose,
            granted: true,
            source: input.source,
          },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });

    return this.requireConsentRow(reminderConsentId);
  }

  /**
   * Revoga. Imediato e irreversivelmente registrado: grava nova linha `granted = false`
   * com `revokedAt`, sem apagar nem alterar a concessão anterior.
   */
  async revoke(input: RevokeConsentInput, actor: ActorContext): Promise<ReminderConsentRow> {
    assertRetentionActor(actor, input.userId);
    const reminderConsentId = createUuidV7();
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      await transaction.insert(reminderConsents).values({
        reminderConsentId,
        userId: input.userId,
        channel: input.channel,
        purpose: input.purpose,
        granted: false,
        grantedAt: null,
        revokedAt: now,
        policyVersion: CONSENT_POLICY_VERSION,
        evidence: buildConsentEvidence({
          actor,
          source: input.source,
          recordedAt: now,
          extra: input.extra,
        }),
        recordedAt: now,
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "retention.consent.revoked",
          schemaVersion: 1,
          aggregateType: "ReminderConsent",
          aggregateId: reminderConsentId,
          aggregateVersion: 1,
          occurredAt: now,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: {
            reminderConsentId,
            userId: input.userId,
            channel: input.channel,
            purpose: input.purpose,
            policyVersion: CONSENT_POLICY_VERSION,
            revokedAt: now.toISOString(),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "retention.consent.revoke",
          resourceType: "ReminderConsent",
          resourceId: reminderConsentId,
          policyVersion: CONSENT_POLICY_VERSION,
          afterRedacted: {
            channel: input.channel,
            purpose: input.purpose,
            granted: false,
            source: input.source,
          },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });

    return this.requireConsentRow(reminderConsentId);
  }

  /** Estado corrente literal: `true` só se a última linha for uma concessão viva. */
  async isGranted(target: ConsentTarget, actor: ActorContext): Promise<boolean> {
    assertRetentionActor(actor, target.userId);
    const fact = await this.currentConsentFact(target);
    return evaluateConsentState(fact) === "GRANTED";
  }

  /**
   * Fato de consentimento sem guarda de ator. Uso interno do módulo (ReminderService) e de
   * rotinas de sistema já autorizadas na camada de API.
   */
  async currentConsentFact(target: ConsentTarget): Promise<ReminderConsentFact | null> {
    const [row] = await this.db
      .select()
      .from(reminderConsents)
      .where(
        and(
          eq(reminderConsents.userId, target.userId),
          eq(reminderConsents.channel, target.channel),
          eq(reminderConsents.purpose, target.purpose),
        ),
      )
      .orderBy(desc(reminderConsents.recordedAt), desc(reminderConsents.reminderConsentId))
      .limit(1);

    return toConsentFact(row);
  }

  /** Painel de preferências: estado atual de cada par (finalidade, canal) da pessoa. */
  async listForUser(
    userId: string,
    actor: ActorContext,
  ): Promise<{ data: ConsentStatus[]; asOf: Date }> {
    assertRetentionActor(actor, userId);
    const asOf = new Date();
    const rows = await this.db
      .select()
      .from(reminderConsents)
      .where(eq(reminderConsents.userId, userId))
      .orderBy(desc(reminderConsents.recordedAt), desc(reminderConsents.reminderConsentId));

    const latestByKey = new Map<string, ReminderConsentRow>();
    for (const row of rows) {
      const key = `${row.purpose}|${row.channel}`;
      if (!latestByKey.has(key)) latestByKey.set(key, row);
    }

    const data: ConsentStatus[] = [];
    for (const row of latestByKey.values()) {
      const purpose = row.purpose as ReminderPurpose;
      const channel = row.channel as ReminderChannel;
      data.push({
        userId,
        purpose,
        channel,
        state: evaluateConsentState(toConsentFact(row)),
        requiresExplicitConsent: requiresExplicitConsent(purpose, channel),
        policyVersion: row.policyVersion,
        decidedAt: row.recordedAt,
      });
    }

    return { data, asOf };
  }

  private async requireConsentRow(reminderConsentId: string): Promise<ReminderConsentRow> {
    const [row] = await this.db
      .select()
      .from(reminderConsents)
      .where(eq(reminderConsents.reminderConsentId, reminderConsentId))
      .limit(1);

    if (!row) {
      throw new AppProblem({
        status: 500,
        code: "RETENTION_CONSENT_NOT_PERSISTED",
        title: "Registro de consentimento indisponível",
        detail: "O consentimento foi gravado mas não pôde ser lido de volta.",
      });
    }
    return row;
  }
}

export {
  evaluateConsentState,
  requiresExplicitConsent,
  type ConsentState,
  type ReminderConsentFact,
};
