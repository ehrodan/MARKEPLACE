export function isSafeCatalogAssetUri(input: string): boolean {
  if (input.startsWith("/") && !input.startsWith("//")) {
    let decoded = input;
    try {
      for (let pass = 0; pass < 2; pass += 1) decoded = decodeURIComponent(decoded);
    } catch {
      return false;
    }
    if (decoded.includes("\\") || decoded.includes("\0")) return false;
    return !decoded.split("/").includes("..");
  }
  if (/^s3:\/\/[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\/[^\s]+$/u.test(input)) return true;
  try {
    const url = new URL(input);
    return (url.protocol === "https:" || url.protocol === "http:")
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}
