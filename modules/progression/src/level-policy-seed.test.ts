import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createAccountLevelPolicyVersion, type AccountLevelDefinition } from "./level-policy.js";

/**
 * Prova que o seed da migration, a fábrica de policy e o PRD concordam.
 *
 * Por que este teste existe: `createAccountLevelPolicyVersion` é uma FÁBRICA que
 * valida limiares recebidos de fora. Os limiares reais vivem em
 * `migrations/0015_progression.sql` e vêm de `RF-237` do PRD. Se as três fontes
 * divergirem, o nível do vendedor fica errado e ninguém percebe — nível errado
 * muda taxa, ranking e recompensa.
 *
 * O teste lê o SQL do disco. Mudar o seed sem mudar o PRD (ou o contrário)
 * quebra aqui, antes de chegar em produção.
 */

const MIGRATION_CANDIDATES = [
  "modules/progression/migrations/0015_progression.sql",
  "migrations/0015_progression.sql",
];

const migrationPath = MIGRATION_CANDIDATES.map((candidate) =>
  resolve(process.cwd(), candidate),
).find(existsSync);

if (!migrationPath) {
  throw new Error(`0015_progression.sql não encontrado a partir de ${process.cwd()}`);
}

const migration = readFileSync(migrationPath, "utf8");

/** Faixas literais de RF-237, em centavos de BRL. Fonte: docs/01-PRD-MIDAS.md. */
const RF237: readonly AccountLevelDefinition[] = [
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
];

/** Extrai as tuplas do `insert into ... account_level_definitions`. */
function parseSeededDefinitions(sql: string): AccountLevelDefinition[] {
  const rowPattern =
    /\('seller-level-v1',\s*'(L\d{1,2})',\s*(\d+),\s*(\d+|null)\s*\)/g;
  const rows: AccountLevelDefinition[] = [];
  let match: RegExpExecArray | null;

  while ((match = rowPattern.exec(sql)) !== null) {
    const [, level, min, max] = match;
    if (!level || min === undefined || max === undefined) continue;
    rows.push({
      level: level as AccountLevelDefinition["level"],
      minInclusiveMinor: Number(min),
      maxInclusiveMinor: max === "null" ? null : Number(max),
    });
  }

  return rows;
}

describe("seed da política de nível × RF-237", () => {
  const seeded = parseSeededDefinitions(migration);

  it("o seed define exatamente as 10 faixas", () => {
    expect(seeded).toHaveLength(10);
  });

  it("cada faixa do seed é idêntica ao PRD, centavo a centavo", () => {
    expect(seeded).toEqual(RF237);
  });

  it("a fábrica de policy aceita o seed sem reclamar", () => {
    // Se a fábrica recusar, o banco tem um dado que o domínio não consegue usar.
    const policy = createAccountLevelPolicyVersion({
      version: "seller-level-v1",
      definitions: seeded,
    });
    expect(policy.version).toBe("seller-level-v1");
    expect(policy.definitions).toHaveLength(10);
  });

  it("as faixas são contíguas: cada mínimo é o máximo anterior mais um", () => {
    for (let index = 1; index < seeded.length; index += 1) {
      const previous = seeded[index - 1];
      const current = seeded[index];
      if (!previous || !current || previous.maxInclusiveMinor === null) {
        throw new Error("faixa inesperada no seed");
      }
      expect(current.minInclusiveMinor, current.level).toBe(
        previous.maxInclusiveMinor + 1,
      );
    }
  });

  it("somente L10 fica sem teto, e L1 começa em zero", () => {
    expect(seeded[0]?.minInclusiveMinor).toBe(0);
    expect(seeded.at(-1)?.level).toBe("L10");
    expect(seeded.at(-1)?.maxInclusiveMinor).toBeNull();
    for (const definition of seeded.slice(0, -1)) {
      expect(definition.maxInclusiveMinor, definition.level).not.toBeNull();
    }
  });

  it("as bordas do PRD caem no nível certo — R$100,00 é L1 e R$100,01 é L2", () => {
    // O PRD é explícito: limite inferior exclusivo, superior inclusivo.
    const level = (minor: number) =>
      seeded.find(
        (definition) =>
          minor >= definition.minInclusiveMinor &&
          (definition.maxInclusiveMinor === null || minor <= definition.maxInclusiveMinor),
      )?.level;

    expect(level(10_000)).toBe("L1");
    expect(level(10_001)).toBe("L2");
    expect(level(50_000)).toBe("L2");
    expect(level(50_001)).toBe("L3");
    expect(level(5_000_000)).toBe("L9");
    expect(level(5_000_001)).toBe("L10");
    expect(level(999_999_999)).toBe("L10");
    expect(level(0)).toBe("L1");
  });

  it("o seed insere exatamente uma versão publicada em BRL", () => {
    // Guarda contra alguém acrescentar um segundo PUBLISHED em BRL: o índice
    // parcial no banco recusaria, e o teste avisa antes de tentar.
    // O padrão casa a TUPLA do insert, não a palavra solta — 'PUBLISHED'
    // também aparece nos CHECK constraints das tabelas.
    const insertedPublished =
      migration.match(/\(\s*'[^']+',\s*'BRL',\s*'PUBLISHED'/g) ?? [];
    expect(insertedPublished).toHaveLength(1);
  });
});
