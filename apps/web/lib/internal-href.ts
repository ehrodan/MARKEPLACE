const trustedOrigin = "https://ochpoch.invalid";
const forbiddenPathCharacters = /[\\\u0000-\u001f\u007f]/;

export function safeInternalHref(value: string | undefined, fallback?: string): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || forbiddenPathCharacters.test(value)) return fallback ?? null;
  try {
    const parsed = new URL(value, trustedOrigin);
    return parsed.origin === trustedOrigin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : (fallback ?? null);
  } catch {
    return fallback ?? null;
  }
}
