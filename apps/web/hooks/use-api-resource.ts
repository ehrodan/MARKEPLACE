"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, type ApiError } from "@/lib/api-client";

type ResourceState<T> =
  | { status: "idle" | "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: ApiError | Error };

type ResourceResult<T> =
  | { status: "idle" | "loading"; data?: undefined; error?: undefined; retry: () => void }
  | { status: "ready"; data: T; error?: undefined; retry: () => void }
  | { status: "error"; data?: undefined; error: ApiError | Error; retry: () => void };

export function useApiResource<T>(path: string | null): ResourceResult<T> {
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({ status: path ? "loading" : "idle" });

  const retry = useCallback(() => { setRequestVersion((value) => value + 1); }, []);

  useEffect(() => {
    if (!path) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });
    apiRequest<T>(path, { signal: controller.signal })
      .then((data) => { setState({ status: "ready", data }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", error: error instanceof Error ? error : new Error("Falha desconhecida") });
      });

    return () => { controller.abort(); };
  }, [path, requestVersion]);

  if (state.status === "ready") return { status: "ready", data: state.data, retry };
  if (state.status === "error") return { status: "error", error: state.error, retry };
  return { status: state.status, retry };
}
