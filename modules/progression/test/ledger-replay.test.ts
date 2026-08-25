import { describe, expect, it } from "vitest";
import {
  LedgerInvariantError,
  assignAccountLevel,
  replayContributionLedger,
  type LedgerContribution,
} from "../src/index.js";

function sale(overrides: Partial<LedgerContribution> = {}): LedgerContribution {
  return {
    contributionId: "0192aaaa-0000-7000-8000-000000000001",
    sourceKind: "ORDER",
    sourceRef: "order-1",
    amountMinor: 12_000,
    compensatesContributionId: null,
    occurredAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function refund(overrides: Partial<LedgerContribution> = {}): LedgerContribution {
  return {
    contributionId: "0192aaaa-0000-7000-8000-000000000002",
    sourceKind: "REFUND",
    sourceRef: "refund-1",
    amountMinor: -2_000,
    compensatesContributionId: "0192aaaa-0000-7000-8000-000000000001",
    occurredAt: "2026-08-02T12:00:00.000Z",
    ...overrides,
  };
}

describe("replayContributionLedger", () => {
  it("ledger vazio replaya para zero e nível L1", () => {
    const replay = replayContributionLedger([]);
    expect(replay.qualifiedLifetimeGmvMinor).toBe(0);
    expect(replay.compensatedGmvMinor).toBe(0);
    expect(replay.appliedContributionCount).toBe(0);
    expect(replay.checksum).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(assignAccountLevel(replay.qualifiedLifetimeGmvMinor).level).toBe("L1");
  });

  it("soma vendas e subtrai compensações sem apagar a contribuição original", () => {
    const replay = replayContributionLedger([sale(), refund()]);
    expect(replay.qualifiedLifetimeGmvMinor).toBe(10_000);
    expect(replay.compensatedGmvMinor).toBe(2_000);
    expect(replay.appliedContributionCount).toBe(2);
    expect(assignAccountLevel(replay.qualifiedLifetimeGmvMinor).level).toBe("L1");
  });

  it("refund posterior pode reduzir o nível corrente", () => {
    const bigSale = sale({ amountMinor: 60_000 });
    expect(assignAccountLevel(replayContributionLedger([bigSale]).qualifiedLifetimeGmvMinor).level)
      .toBe("L3");
    const afterRefund = replayContributionLedger([
      bigSale,
      refund({ amountMinor: -55_000, sourceRef: "refund-big" }),
    ]);
    expect(afterRefund.qualifiedLifetimeGmvMinor).toBe(5_000);
    expect(assignAccountLevel(afterRefund.qualifiedLifetimeGmvMinor).level).toBe("L1");
  });

  it("checksum é canônico: independe da ordem das linhas", () => {
    const forward = replayContributionLedger([sale(), refund()]);
    const reversed = replayContributionLedger([refund(), sale()]);
    expect(forward.checksum).toBe(reversed.checksum);
    const different = replayContributionLedger([sale()]);
    expect(different.checksum).not.toBe(forward.checksum);
  });

  it("rejeita compensação órfã, excedente, positiva e base negativa", () => {
    expect(() => replayContributionLedger([refund()])).toThrow(LedgerInvariantError);
    expect(() =>
      replayContributionLedger([sale({ amountMinor: 1_000 }), refund({ amountMinor: -2_000 })]),
    ).toThrow(/excedem/);
    expect(() =>
      replayContributionLedger([sale(), refund({ amountMinor: 500 })]),
    ).toThrow(/não pode ser positiva/);
    expect(() =>
      replayContributionLedger([sale({ amountMinor: -1, compensatesContributionId: null })]),
    ).toThrow(/negativa sem compensar/);
  });

  it("rejeita contributionId duplicado em vez de deduplicar em silêncio", () => {
    expect(() => replayContributionLedger([sale(), sale()])).toThrow(/duplicada/);
  });
});
