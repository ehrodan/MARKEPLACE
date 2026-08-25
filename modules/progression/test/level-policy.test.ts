import { describe, expect, it } from "vitest";
import {
  assignAccountLevel,
  createAccountLevelPolicyVersion,
  INITIAL_ACCOUNT_LEVEL_POLICY,
  type AccountLevel,
  type AccountLevelDefinition,
} from "../src/index.js";

describe("política versionada de níveis L1–L10", () => {
  const thresholds: readonly [number, AccountLevel, AccountLevel][] = [
    [10_000, "L1", "L2"],
    [50_000, "L2", "L3"],
    [100_000, "L3", "L4"],
    [300_000, "L4", "L5"],
    [500_000, "L5", "L6"],
    [750_000, "L6", "L7"],
    [1_000_000, "L7", "L8"],
    [2_000_000, "L8", "L9"],
    [5_000_000, "L9", "L10"],
  ];

  it.each(thresholds)(
    "mantém o limite %i no nível anterior e progride somente no centavo seguinte",
    (threshold, levelAtThreshold, levelAfterThreshold) => {
      expect(assignAccountLevel(threshold - 1).level).toBe(levelAtThreshold);
      expect(assignAccountLevel(threshold).level).toBe(levelAtThreshold);
      expect(assignAccountLevel(threshold + 1).level).toBe(levelAfterThreshold);
    },
  );

  it("cobre zero e todo o intervalo inteiro seguro no L10", () => {
    expect(assignAccountLevel(0)).toMatchObject({
      level: "L1",
      currentLevelMinInclusiveMinor: 0,
      nextLevelMinInclusiveMinor: 10_001,
    });
    expect(assignAccountLevel(Number.MAX_SAFE_INTEGER)).toMatchObject({
      level: "L10",
      currentLevelMinInclusiveMinor: 5_000_001,
      nextLevelMinInclusiveMinor: null,
    });
  });

  it("preserva a versão e congela a política e suas faixas", () => {
    expect(INITIAL_ACCOUNT_LEVEL_POLICY.version).toBe("account-level-brl.v1");
    expect(Object.isFrozen(INITIAL_ACCOUNT_LEVEL_POLICY)).toBe(true);
    expect(Object.isFrozen(INITIAL_ACCOUNT_LEVEL_POLICY.definitions)).toBe(true);
    expect(INITIAL_ACCOUNT_LEVEL_POLICY.definitions.every(Object.isFrozen)).toBe(true);
    expect(Reflect.set(INITIAL_ACCOUNT_LEVEL_POLICY.definitions[0] ?? {}, "maxInclusiveMinor", 1)).toBe(false);
  });

  it("rejeita lacuna, sobreposição e ordem incompleta", () => {
    const withGap: AccountLevelDefinition[] = INITIAL_ACCOUNT_LEVEL_POLICY.definitions.map(
      (definition) => ({ ...definition }),
    );
    const levelTwo = withGap[1];
    if (!levelTwo) {
      throw new Error("Fixture de nível incompleta.");
    }
    withGap[1] = { ...levelTwo, minInclusiveMinor: 10_002 };

    expect(() => createAccountLevelPolicyVersion({ version: "gap.v1", definitions: withGap })).toThrow(
      /lacuna ou sobreposição/i,
    );
    expect(() => createAccountLevelPolicyVersion({
      version: "incomplete.v1",
      definitions: INITIAL_ACCOUNT_LEVEL_POLICY.definitions.slice(0, 9),
    })).toThrow(/exatamente L1 até L10/i);
  });

  it("rejeita L10 com teto finito para não deixar GMV descoberto", () => {
    const finiteLevelTen: AccountLevelDefinition[] = INITIAL_ACCOUNT_LEVEL_POLICY.definitions.map(
      (definition) => (
        definition.level === "L10"
          ? { ...definition, maxInclusiveMinor: 9_000_000 }
          : { ...definition }
      ),
    );
    expect(() => createAccountLevelPolicyVersion({
      version: "finite-l10.v1",
      definitions: finiteLevelTen,
    })).toThrow(/L10 deve permanecer sem limite superior/i);
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejeita volume inválido %s",
    (invalidVolume) => {
      expect(() => assignAccountLevel(invalidVolume)).toThrow(RangeError);
    },
  );
});
