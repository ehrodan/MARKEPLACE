export function formatMinorAmount(
  amountMinor: string | number,
  currency: string,
  locale = "pt-BR",
): string {
  const normalized = String(amountMinor);
  if (!/^-?\d+$/.test(normalized)) return `${normalized} ${currency}`;
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10n ** BigInt(fractionDigits);
  const value = BigInt(normalized);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const major = absolute / scale;
  const minor = (absolute % scale).toString().padStart(fractionDigits, "0");
  const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(major);
  const parts = formatter.formatToParts(0);
  const symbol = parts.find((part) => part.type === "currency")?.value ?? currency;
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ",";
  const fraction = fractionDigits > 0 ? `${decimal}${minor}` : "";
  return `${negative ? "−" : ""}${symbol} ${integer}${fraction}`;
}

export function MinorMoney({ amountMinor, currency, className = "" }: {
  amountMinor: string | number;
  currency: string;
  className?: string;
}) {
  return <span className={className}>{formatMinorAmount(amountMinor, currency)}</span>;
}
