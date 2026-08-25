import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  HOLD_DURATION_HOURS,
  hasAmount,
  holdBlockReasonOrder,
  holdReasonLabel,
  holdReasonMeaning,
  holdReasonSellerAction,
  isHoldReason,
  readSellerBalance,
} from "./hold-facts";

const policySource = readFileSync(
  resolve(process.cwd(), "../../modules/finance/src/hold-policy.ts"),
  "utf8",
);

/**
 * `apps/web` não pode importar `@midas/finance` (só depende de `@midas/ui`), então
 * a política é espelhada. Estes testes leem o arquivo do domínio e falham se o
 * espelho divergir — é o único jeito honesto de manter duplicação.
 */
describe("espelho de modules/finance/src/hold-policy.ts", () => {
  it("mantém a mesma duração de retenção do domínio", () => {
    expect(policySource).toContain(`HOLD_DURATION_HOURS = ${String(HOLD_DURATION_HOURS)}`);
  });

  it("cobre todos os reasonCode de bloqueio do domínio, sem sobra", () => {
    const domainReasons = [...policySource.matchAll(/reasonCode:\s*"([A-Z_]+)"/gu)]
      .map((match) => match[1])
      .filter((reason) => reason !== "ELIGIBLE");

    expect(new Set(domainReasons)).toEqual(new Set(holdBlockReasonOrder));
  });

  it("preserva a ordem em que evaluateHoldRelease decide", () => {
    const positions = holdBlockReasonOrder.map((reason) => policySource.indexOf(`"${reason}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    const sorted = [...positions].sort((left, right) => left - right);
    expect(positions).toEqual(sorted);
  });
});

describe("texto de cada motivo", () => {
  it("tem rótulo e significado para bloqueio e para elegível", () => {
    for (const reason of [...holdBlockReasonOrder, "ELIGIBLE"] as const) {
      expect(holdReasonLabel(reason).length).toBeGreaterThan(0);
      expect(holdReasonMeaning(reason).length).toBeGreaterThan(0);
    }
  });

  it("não promete ação do vendedor onde ele não pode agir", () => {
    expect(holdReasonSellerAction("HOLD_WINDOW_ACTIVE")).toBeNull();
    expect(holdReasonSellerAction("PAYMENT_NOT_RECONCILED")).toBeNull();
    expect(holdReasonSellerAction("DISPUTE_OPEN")).not.toBeNull();
  });

  it("elegível não afirma que o dinheiro saiu", () => {
    expect(holdReasonMeaning("ELIGIBLE")).toContain("não significa que o dinheiro já saiu");
  });

  it("conta a janela a partir da liquidação, não do pedido", () => {
    expect(holdReasonMeaning("HOLD_WINDOW_ACTIVE")).toContain("liquidação do pagamento");
    expect(holdReasonMeaning("HOLD_WINDOW_ACTIVE")).toContain("168");
  });

  it("reconhece só os códigos do contrato", () => {
    expect(isHoldReason("DISPUTE_OPEN")).toBe(true);
    expect(isHoldReason("ELIGIBLE")).toBe(true);
    expect(isHoldReason("RETIDO")).toBe(false);
    expect(isHoldReason(null)).toBe(false);
  });
});

const balance = {
  sellerAccountId: "sac_2f1c4d0e-2f2b-4d2f-9f0e-77c1b5c39f01",
  currency: "BRL",
  heldAmountMinor: "45000",
  availableAmountMinor: "12000",
  reservedAmountMinor: "0",
  asOf: "2026-08-24T03:00:00.000Z",
};

describe("readSellerBalance", () => {
  it("lê os três buckets separados", () => {
    const read = readSellerBalance(balance);
    expect(read?.heldAmountMinor).toBe("45000");
    expect(read?.availableAmountMinor).toBe("12000");
    expect(read?.reservedAmountMinor).toBe("0");
    expect(read?.currency).toBe("BRL");
  });

  it("recusa dinheiro em number, em decimal e moeda minúscula", () => {
    expect(readSellerBalance({ ...balance, heldAmountMinor: 45000 })).toBeNull();
    expect(readSellerBalance({ ...balance, availableAmountMinor: "120.00" })).toBeNull();
    expect(readSellerBalance({ ...balance, currency: "brl" })).toBeNull();
    expect(readSellerBalance({ ...balance, asOf: "hoje" })).toBeNull();
    expect(readSellerBalance(null)).toBeNull();
  });
});

describe("hasAmount", () => {
  it("distingue bucket com valor de bucket zerado", () => {
    expect(hasAmount("45000")).toBe(true);
    expect(hasAmount("0")).toBe(false);
    expect(hasAmount("00")).toBe(false);
  });

  it("trata valor fora do formato como ausência, nunca como positivo", () => {
    expect(hasAmount("-1")).toBe(false);
    expect(hasAmount("1,00")).toBe(false);
  });
});
