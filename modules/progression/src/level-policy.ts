import { assertMinorBrl, assertNonEmptyVersion, freezeArray } from "./money.js";

export type AccountLevel = "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7" | "L8" | "L9" | "L10";

export interface AccountLevelDefinition {
  readonly level: AccountLevel;
  readonly minInclusiveMinor: number;
  readonly maxInclusiveMinor: number | null;
}

export interface AccountLevelPolicyVersion {
  readonly version: string;
  readonly currency: "BRL";
  readonly definitions: readonly AccountLevelDefinition[];
}

export interface AccountLevelAssignment {
  readonly policyVersion: string;
  readonly currency: "BRL";
  readonly qualifiedLifetimeGmvMinor: number;
  readonly level: AccountLevel;
  readonly currentLevelMinInclusiveMinor: number;
  readonly nextLevelMinInclusiveMinor: number | null;
}

const orderedLevels: readonly AccountLevel[] = Object.freeze([
  "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10",
]);

export function createAccountLevelPolicyVersion(input: {
  readonly version: string;
  readonly definitions: readonly AccountLevelDefinition[];
}): AccountLevelPolicyVersion {
  assertNonEmptyVersion(input.version);
  if (input.definitions.length !== orderedLevels.length) {
    throw new RangeError("A política de nível deve definir exatamente L1 até L10.");
  }

  const definitions = input.definitions.map((definition, index) => {
    const expectedLevel = orderedLevels[index];
    if (!expectedLevel) {
      throw new RangeError("A política recebeu uma faixa de nível excedente.");
    }
    if (definition.level !== expectedLevel) {
      throw new TypeError(`A definição ${String(index + 1)} deve ser ${expectedLevel}.`);
    }
    assertMinorBrl(definition.minInclusiveMinor, `${definition.level}.minInclusiveMinor`);
    if (index === 0 && definition.minInclusiveMinor !== 0) {
      throw new RangeError("L1 deve começar em zero centavos.");
    }
    if (definition.maxInclusiveMinor === null) {
      if (definition.level !== "L10") {
        throw new RangeError("Somente L10 pode não possuir limite superior.");
      }
    } else {
      if (definition.level === "L10") {
        throw new RangeError("L10 deve permanecer sem limite superior.");
      }
      assertMinorBrl(definition.maxInclusiveMinor, `${definition.level}.maxInclusiveMinor`);
      if (definition.maxInclusiveMinor < definition.minInclusiveMinor) {
        throw new RangeError(`${definition.level} possui intervalo invertido.`);
      }
    }

    const previous = input.definitions[index - 1];
    if (previous) {
      if (previous.maxInclusiveMinor === null) {
        throw new RangeError("Uma faixa sem limite superior deve ser a última.");
      }
      if (definition.minInclusiveMinor !== previous.maxInclusiveMinor + 1) {
        throw new RangeError(`Existe lacuna ou sobreposição antes de ${definition.level}.`);
      }
    }

    return Object.freeze({
      level: definition.level,
      minInclusiveMinor: definition.minInclusiveMinor,
      maxInclusiveMinor: definition.maxInclusiveMinor,
    });
  });

  return Object.freeze({
    version: input.version,
    currency: "BRL" as const,
    definitions: freezeArray(definitions),
  });
}

export const INITIAL_ACCOUNT_LEVEL_POLICY = createAccountLevelPolicyVersion({
  version: "account-level-brl.v1",
  definitions: [
    { level: "L1", minInclusiveMinor: 0, maxInclusiveMinor: 10_000 },
    { level: "L2", minInclusiveMinor: 10_001, maxInclusiveMinor: 50_000 },
    { level: "L3", minInclusiveMinor: 50_001, maxInclusiveMinor: 100_000 },
    { level: "L4", minInclusiveMinor: 100_001, maxInclusiveMinor: 300_000 },
    { level: "L5", minInclusiveMinor: 300_001, maxInclusiveMinor: 500_000 },
    { level: "L6", minInclusiveMinor: 500_001, maxInclusiveMinor: 750_000 },
    { level: "L7", minInclusiveMinor: 750_001, maxInclusiveMinor: 1_000_000 },
    { level: "L8", minInclusiveMinor: 1_000_001, maxInclusiveMinor: 2_000_000 },
    { level: "L9", minInclusiveMinor: 2_000_001, maxInclusiveMinor: 5_000_000 },
    { level: "L10", minInclusiveMinor: 5_000_001, maxInclusiveMinor: null },
  ],
});

export function assignAccountLevel(
  qualifiedLifetimeGmvMinor: number,
  policy: AccountLevelPolicyVersion = INITIAL_ACCOUNT_LEVEL_POLICY,
): AccountLevelAssignment {
  assertMinorBrl(qualifiedLifetimeGmvMinor, "qualifiedLifetimeGmvMinor");
  const index = policy.definitions.findIndex((definition) =>
    qualifiedLifetimeGmvMinor >= definition.minInclusiveMinor
    && (definition.maxInclusiveMinor === null || qualifiedLifetimeGmvMinor <= definition.maxInclusiveMinor));
  const definition = policy.definitions[index];
  if (!definition) {
    throw new RangeError("A política não cobre o valor informado.");
  }
  const next = policy.definitions[index + 1];
  return Object.freeze({
    policyVersion: policy.version,
    currency: policy.currency,
    qualifiedLifetimeGmvMinor,
    level: definition.level,
    currentLevelMinInclusiveMinor: definition.minInclusiveMinor,
    nextLevelMinInclusiveMinor: next?.minInclusiveMinor ?? null,
  });
}
