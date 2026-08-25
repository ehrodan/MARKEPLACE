const BRL_INPUT = /^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/;

export function parseBrlMinor(input: string): number | null {
  const normalized = input.trim().replace(/^R\$\s*/i, "").replaceAll(" ", "");
  if (!normalized || !BRL_INPUT.test(normalized)) return null;

  const finalSegment = normalized.split(".").at(-1);
  const decimalSeparator = normalized.lastIndexOf(",") >= 0
    ? ","
    : normalized.lastIndexOf(".") >= 0 && finalSegment !== undefined && finalSegment.length <= 2
      ? "."
      : null;
  const [majorInput, fractionInput = ""] = decimalSeparator
    ? normalized.split(decimalSeparator)
    : [normalized, ""];
  const major = majorInput.replaceAll(".", "");
  const fraction = fractionInput.padEnd(2, "0");
  const amountMinor = Number(`${major}${fraction}`);
  return Number.isSafeInteger(amountMinor) && amountMinor > 0 ? amountMinor : null;
}

export function formatMinorString(amountMinor: string, currency: string): string {
  const amount = Number(amountMinor);
  if (!Number.isSafeInteger(amount)) return `${currency} ${amountMinor}`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function formatRate(rate: string): string {
  const numericRate = Number(rate);
  if (!Number.isFinite(numericRate)) return rate;
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(numericRate);
}
