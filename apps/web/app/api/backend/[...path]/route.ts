import { NextResponse, type NextRequest } from "next/server";
import { validateProxyRequest } from "@/lib/proxy-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_REQUEST_HEADERS = ["accept", "content-type", "cookie", "idempotency-key", "if-match", "x-midas-csrf"];
const MAX_BODY_BYTES = 32 * 1024;

class BodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the BFF limit");
    this.name = "BodyTooLargeError";
  }
}

async function readLimitedBody(request: NextRequest, method: string): Promise<ArrayBuffer | undefined> {
  if (method === "GET" || !request.body) return undefined;
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) throw new BodyTooLargeError();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    let result = await reader.read();
    while (!result.done) {
      totalBytes += result.value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(result.value);
      result = await reader.read();
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBuffer = new ArrayBuffer(totalBytes);
  const body = new Uint8Array(bodyBuffer);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bodyBuffer;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  const policy = validateProxyRequest(request.method, segments);

  if (!policy.allowed) {
    return NextResponse.json({
      type: "about:blank",
      title: "Rota de integração não permitida",
      status: policy.status,
      code: policy.code,
    }, { status: policy.status, headers: { "cache-control": "no-store" } });
  }

  const apiBase = process.env.MIDAS_API_URL || "http://127.0.0.1:3001";
  const upstream = new URL(`${apiBase.replace(/\/$/, "")}/${policy.path}`);
  upstream.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of SAFE_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-forwarded-host", request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  try {
    const body = await readLimitedBody(request, policy.method);
    const upstreamResponse = await fetch(upstream, {
      method: policy.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-language", "etag", "x-correlation-id"]) {
      const value = upstreamResponse.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("cache-control", "no-store");

    const setCookies = upstreamResponse.headers.getSetCookie();
    for (const cookie of setCookies) responseHeaders.append("set-cookie", cookie);
    if (!setCookies.length) {
      const cookie = upstreamResponse.headers.get("set-cookie");
      if (cookie) responseHeaders.append("set-cookie", cookie);
    }

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({
        type: "about:blank",
        title: "Corpo da requisição excede o limite",
        status: 413,
        code: "PAYLOAD_TOO_LARGE",
        detail: `O limite desta integração é ${String(MAX_BODY_BYTES)} bytes.`,
      }, { status: 413, headers: { "cache-control": "no-store" } });
    }
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return NextResponse.json({
      type: "about:blank",
      title: "API indisponível",
      status: 503,
      code: timedOut ? "UPSTREAM_TIMEOUT" : "DEPENDENCY_UNAVAILABLE",
      detail: "Não foi possível consultar a API agora. Nenhum dado foi presumido.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
