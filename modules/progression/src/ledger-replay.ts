import { fnv1a64 } from "./contribution-replay.js";
import { addMinorBrl, assertIsoInstant } from "./money.js";

/**
 * Replay do ledger persistido em `progression.progression_contributions`
 * (migrations/0015_progression.sql). Difere de `contribution-replay.ts` porque
 * a linha do banco não carrega `planSnapshot`: a fonte aqui é a contribuição
 * já registrada, com compensação apontando para a contribuição original por
 * `compensatesContributionId`. As invariantes espelham as constraints do banco
 * e falham fechado — linha inválida derruba a leitura, nunca vira número.
 */

export type LedgerSourceKind = "ORDER" | "REFUND" | "CHARGEBACK" | "ADJUSTMENT";

export interface LedgerContribution {
  readonly contributionId: string;
  readonly sourceKind: LedgerSourceKind;
  readonly sourceRef: string;
  readonly amountMinor: number;
  readonly compensatesContributionId: string | null;
  readonly occurredAt: string;
}

export interface ContributionLedgerReplay {
  readonly qualifiedLifetimeGmvMinor: number;
  readonly compensatedGmvMinor: number;
  readonly appliedContributionCount: number;
  readonly checksum: string;
}

export class LedgerInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LedgerInvariantError";
  }
}

const ledgerSourceKinds: readonly LedgerSourceKind[] = Object.freeze([
  "ORDER",
  "REFUND",
  "CHARGEBACK",
  "ADJUSTMENT",
]);

function assertLedgerContribution(contribution: LedgerContribution): void {
  if (contribution.contributionId.trim().length === 0) {
    throw new LedgerInvariantError("contributionId não pode ser vazio.");
  }
  if (!ledgerSourceKinds.includes(contribution.sourceKind)) {
    throw new LedgerInvariantError(
      `A contribuição ${contribution.contributionId} possui sourceKind desconhecido.`,
    );
  }
  if (contribution.sourceRef.trim().length === 0) {
    throw new LedgerInvariantError(
      `A contribuição ${contribution.contributionId} não possui sourceRef.`,
    );
  }
  if (!Number.isSafeInteger(contribution.amountMinor)) {
    throw new LedgerInvariantError(
      `A contribuição ${contribution.contributionId} excede o intervalo seguro de centavos.`,
    );
  }
  assertIsoInstant(contribution.occurredAt, `occurredAt(${contribution.contributionId})`);
  if (contribution.compensatesContributionId === null) {
    if (contribution.amountMinor < 0) {
      throw new LedgerInvariantError(
        `A contribuição ${contribution.contributionId} é negativa sem compensar ninguém.`,
      );
    }
    return;
  }
  if (contribution.amountMinor > 0) {
    throw new LedgerInvariantError(
      `A compensação ${contribution.contributionId} não pode ser positiva.`,
    );
  }
}

function fingerprint(contribution: LedgerContribution): string {
  return JSON.stringify([
    contribution.contributionId,
    contribution.sourceKind,
    contribution.sourceRef,
    contribution.amountMinor,
    contribution.compensatesContributionId,
    contribution.occurredAt,
  ]);
}

export function replayContributionLedger(
  contributions: readonly LedgerContribution[],
): ContributionLedgerReplay {
  const baseAmountsById = new Map<string, number>();
  for (const contribution of contributions) {
    assertLedgerContribution(contribution);
    if (baseAmountsById.has(contribution.contributionId)) {
      throw new LedgerInvariantError(
        `A contribuição ${contribution.contributionId} aparece duplicada no ledger.`,
      );
    }
    baseAmountsById.set(contribution.contributionId, contribution.amountMinor);
  }

  const compensatedByBase = new Map<string, number>();
  let qualifiedLifetimeGmvMinor = 0;
  let compensatedGmvMinor = 0;

  for (const contribution of contributions) {
    if (contribution.compensatesContributionId !== null) {
      const baseAmount = baseAmountsById.get(contribution.compensatesContributionId);
      if (baseAmount === undefined || baseAmount < 0) {
        throw new LedgerInvariantError(
          `A compensação ${contribution.contributionId} aponta para contribuição inexistente.`,
        );
      }
      const compensated = addMinorBrl(
        compensatedByBase.get(contribution.compensatesContributionId) ?? 0,
        -contribution.amountMinor,
        `compensatedGmvMinor(${contribution.compensatesContributionId})`,
      );
      if (compensated > baseAmount) {
        throw new LedgerInvariantError(
          `As compensações de ${contribution.compensatesContributionId} excedem a contribuição original.`,
        );
      }
      compensatedByBase.set(contribution.compensatesContributionId, compensated);
      compensatedGmvMinor = addMinorBrl(
        compensatedGmvMinor,
        -contribution.amountMinor,
        "compensatedGmvMinor",
      );
    }
    qualifiedLifetimeGmvMinor = addMinorBrl(
      qualifiedLifetimeGmvMinor,
      contribution.amountMinor,
      "qualifiedLifetimeGmvMinor",
    );
  }

  const canonicalFingerprints = contributions.map(fingerprint).sort();
  return Object.freeze({
    qualifiedLifetimeGmvMinor,
    compensatedGmvMinor,
    appliedContributionCount: contributions.length,
    checksum: fnv1a64(JSON.stringify(canonicalFingerprints)),
  });
}
