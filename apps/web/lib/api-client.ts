import type { ProblemDetails } from "./api-types";

export class ApiError extends Error {
  constructor(public readonly problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = "ApiError";
  }
}

function fallbackProblem(status: number): ProblemDetails {
  return {
    title: status >= 500 ? "Dependência indisponível" : "A solicitação não pôde ser concluída",
    status,
    code: status === 404 ? "CAPABILITY_NOT_IMPLEMENTED" : "UNEXPECTED_RESPONSE",
  };
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const mutating = method !== "GET" && method !== "HEAD";
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json, application/problem+json");
  if (init.body) headers.set("content-type", "application/json");
  if (mutating) headers.set("X-Midas-CSRF", "1");
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });

  if (!response.ok) {
    let problem = fallbackProblem(response.status);
    try {
      const parsed = await response.json() as Partial<ProblemDetails>;
      problem = {
        ...problem,
        ...parsed,
        status: response.status,
        title: parsed.title || problem.title,
      };
    } catch {
      // A resposta continua falhando de forma tipada sem expor corpo inesperado.
    }
    throw new ApiError(problem);
  }

  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
