export function formatMinorUnits(amountMinor: number, currency: string, locale = "pt-BR") {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new TypeError("amountMinor precisa ser um inteiro seguro");
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / (10 ** fractionDigits));
}

export interface MoneyProps {
  amountMinor: number;
  currency: string;
  className?: string;
}

export function Money({ amountMinor, currency, className = "" }: MoneyProps) {
  return <span className={`ui-money ${className}`.trim()}>{formatMinorUnits(amountMinor, currency)}</span>;
}
