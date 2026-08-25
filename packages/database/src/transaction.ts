import type { MidasDatabase, MidasTransaction } from "./database.js";

const retryableSqlStates = new Set(["40001", "40P01"]);

function sqlStateFrom(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  if ("code" in error) {
    return typeof error.code === "string" ? error.code : undefined;
  }

  if (!("cause" in error)) return undefined;
  const { cause } = error;
  if (typeof cause !== "object" || cause === null || !("code" in cause)) return undefined;
  return typeof cause.code === "string" ? cause.code : undefined;
}

export function isRetryableTransactionError(error: unknown): boolean {
  const sqlState = sqlStateFrom(error);
  return sqlState !== undefined && retryableSqlStates.has(sqlState);
}

export async function withSerializableTransaction<T>(
  db: MidasDatabase,
  operation: (transaction: MidasTransaction) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await db.transaction(operation, {
        isolationLevel: "serializable",
        accessMode: "read write",
      });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt >= maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 * attempt + Math.random() * 20));
    }
  }
  throw new Error("Número de tentativas transacionais esgotado");
}
