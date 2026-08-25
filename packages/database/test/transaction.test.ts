import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it, vi } from "vitest";
import type { MidasDatabase } from "../src/index.js";
import { isRetryableTransactionError, withSerializableTransaction } from "../src/index.js";

function wrappedQueryError(code: unknown): DrizzleQueryError {
  return new DrizzleQueryError(
    "update wallets set balance = balance + 1",
    [],
    Object.assign(new Error("falha do PostgreSQL"), { code }),
  );
}

describe("retry transacional", () => {
  it.each(["40001", "40P01"])("reconhece SQLSTATE %s", (code) => {
    expect(isRetryableTransactionError({ code })).toBe(true);
  });

  it.each(["40001", "40P01"])(
    "reconhece SQLSTATE %s encapsulado por DrizzleQueryError",
    (code) => {
      expect(isRetryableTransactionError(wrappedQueryError(code))).toBe(true);
    },
  );

  it("não repete erro de constraint", () => {
    expect(isRetryableTransactionError({ code: "23505" })).toBe(false);
    expect(isRetryableTransactionError(wrappedQueryError("23505"))).toBe(false);
  });

  it("não aceita SQLSTATE com tipo inválido", () => {
    expect(isRetryableTransactionError({ code: 40001 })).toBe(false);
    expect(isRetryableTransactionError(wrappedQueryError(40001))).toBe(false);
  });

  it("repete a transação quando o SQLSTATE transitório vem no cause do Drizzle", async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(wrappedQueryError("40001"))
      .mockResolvedValueOnce("confirmado");
    const db = { transaction } as unknown as MidasDatabase;

    await expect(
      withSerializableTransaction(db, async () => Promise.resolve("confirmado")),
    ).resolves.toBe("confirmado");
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
