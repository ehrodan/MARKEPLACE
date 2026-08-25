export function parseTwoDecimalAmount(value: string): string | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const parts = normalized.split(".");
  const major = parts[0];
  const fraction = (parts.length === 2 ? parts[1] : "").padEnd(2, "0");
  const amountMinor = BigInt(major) * 100n + BigInt(fraction || "0");
  return amountMinor > 0n ? amountMinor.toString() : null;
}
