const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export function validateProxyRequest(method: string, segments: string[]) {
  const normalizedMethod = method.toUpperCase();
  if (!ALLOWED_METHODS.has(normalizedMethod)) {
    return { allowed: false as const, status: 405, code: "METHOD_NOT_ALLOWED" };
  }

  if (!segments.length || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))) {
    return { allowed: false as const, status: 400, code: "INVALID_UPSTREAM_PATH" };
  }

  if (segments[0] !== "v1" && segments[0] !== "health") {
    return { allowed: false as const, status: 404, code: "UPSTREAM_PATH_NOT_ALLOWED" };
  }

  return { allowed: true as const, method: normalizedMethod, path: segments.map(encodeURIComponent).join("/") };
}
