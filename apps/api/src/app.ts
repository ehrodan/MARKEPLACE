import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import Fastify, { type FastifyRequest } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { ZodError, z } from "zod";
import {
  apiProblemSchema,
  createSellerAccountBodySchema,
  loginBodySchema,
  registerUserBodySchema,
  registerUserResponseSchema,
  sellerAccountListResponseSchema,
  sellerAccountSchema,
  sellerMemberListResponseSchema,
  sessionIdSchema,
  sessionListResponseSchema,
  sellerAccountIdSchema,
  verifyUserEmailBodySchema,
} from "@midas/contracts";
import { checkDatabase, type DatabaseHandle } from "@midas/database";
import {
  FinanceService,
  PaymentProviderRegistry,
  PayoutExecutionCapabilityRegistry,
} from "@midas/finance";
import { IdentityService, type VerificationDeliveryPort } from "@midas/identity";
import { AppProblem, parsePublicId, parseUuid, validationProblem } from "@midas/kernel";
import { SellerService } from "@midas/sellers";
import type { ApiConfig } from "./config.js";
import { actorContext } from "./http/request-context.js";
import {
  clearSessionCookie,
  createSessionCookie,
  parseCookie,
  sessionCookieName,
} from "./http/cookies.js";
import { registerFinanceRoutes } from "./finance-routes.js";
import { registerCatalogRoutes } from "./catalog-routes.js";
import { registerOrderRoutes } from "./order-routes.js";
import { registerRetentionRoutes } from "./retention-routes.js";
import { registerProgressionRoutes } from "./progression-routes.js";
import { ProgressionService } from "@midas/progression";
import { CartService, DeliveryService, OrderService } from "@midas/orders";
import {
  ConsentService,
  ReminderService,
  SavedCartService,
  WatchlistService,
} from "@midas/retention";
import { StripePaymentAdapter } from "./adapters/stripe-payment-adapter.js";
import { MercadoPagoPaymentAdapter } from "./adapters/mercadopago-payment-adapter.js";
import { CatalogService, AssetService } from "@midas/catalog";

export type BuildApiOptions = {
  config: ApiConfig;
  database: DatabaseHandle;
  verificationDelivery: VerificationDeliveryPort;
};

type RawBodyRequest = FastifyRequest & { rawBody?: Buffer };

export function buildApi(options: BuildApiOptions) {
  const app = Fastify({
    logger: {
      level: options.config.nodeEnv === "test" ? "silent" : "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "body.password",
        "body.token",
      ],
    },
    genReqId: () => randomUUID(),
    trustProxy: false,
    bodyLimit: 32 * 1024,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorateRequest("rawBody", null);

  const identity = new IdentityService(options.database.db, {
    sessionTtlSeconds: options.config.sessionTtlSeconds,
    verificationTtlSeconds: options.config.verificationTtlSeconds,
    authRateLimitAttempts: options.config.authRateLimitAttempts,
    authRateLimitWindowSeconds: options.config.authRateLimitWindowSeconds,
  });
  const sellers = new SellerService(options.database.db);
  const finance = new FinanceService(options.database.db);
  const catalog = new CatalogService(options.database.db);
  const assets = new AssetService(options.database.db);
  const carts = new CartService(options.database.db);
  const orders = new OrderService(options.database.db);
  const deliveries = new DeliveryService(options.database.db);
  const progression = new ProgressionService(options.database.db);
  const savedCarts = new SavedCartService(options.database.db);
  const watchlist = new WatchlistService(options.database.db);
  const reminders = new ReminderService(options.database.db);
  const reminderConsent = new ConsentService(options.database.db);

  // PSP adapters: instanciados baseado na config, fail-closed se não configurado
  const stripeAdapter = new StripePaymentAdapter(
    options.config.stripeSecretKey,
    options.config.stripeWebhookSecret,
  );
  const mercadopagoAdapter = new MercadoPagoPaymentAdapter(
    options.config.mercadopagoAccessToken,
    options.config.mercadopagoWebhookSecret,
  );

  const pspAdapters = [stripeAdapter, mercadopagoAdapter].filter(
    (adapter) => adapter.isConfigured(),
  );

  const selectedProviderCode = options.config.pspProvider === "none" ? undefined : options.config.pspProvider;
  const paymentProviderRegistry = new PaymentProviderRegistry(selectedProviderCode, pspAdapters);
  const payoutExecutionRegistry = new PayoutExecutionCapabilityRegistry();
  const secureCookie = options.config.nodeEnv === "production";

  app.addHook("preParsing", async (request, _reply, payload) => {
    if (request.routeOptions.url !== "/v1/provider-webhooks/:providerCode") return payload;
    const chunks: Buffer[] = [];
    const capture = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback(null, chunk);
      },
      flush(callback) {
        (request as RawBodyRequest).rawBody = Buffer.concat(chunks);
        callback();
      },
    });
    return payload.pipe(capture);
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-correlation-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cache-control", "no-store");
    const origin = request.headers.origin;
    if (origin && options.config.corsAllowedOrigins.has(origin)) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-credentials", "true");
      reply.header("vary", "Origin");
      reply.header("access-control-allow-headers", "content-type,idempotency-key,x-midas-csrf,x-correlation-id");
      reply.header("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }
    if (request.method === "OPTIONS") {
      if (!origin || !options.config.corsAllowedOrigins.has(origin)) {
        throw new AppProblem({
          status: 403,
          code: "ORIGIN_NOT_ALLOWED",
          title: "Origem não autorizada",
          detail: "A origem da solicitação não é permitida.",
        });
      }
      return reply.status(204).send();
    }
  });

  app.setNotFoundHandler((request, reply) => {
    const problem = new AppProblem({
      status: 404,
      code: "ROUTE_NOT_FOUND",
      title: "Recurso não encontrado",
      detail: "A rota solicitada não existe neste corte da API.",
    });
    return reply
      .status(404)
      .type("application/problem+json")
      .send(problem.toProblemDetails(request.id, options.config.errorBaseUrl));
  });

  app.setErrorHandler((error, request, reply) => {
    const problem = normalizeError(error);
    if (problem.status >= 500) {
      request.log.error({ err: error, errorCode: problem.code }, "request failed");
    } else if (problem.status === 401 || problem.status === 403 || problem.status === 429) {
      request.log.warn({ errorCode: problem.code }, "request rejected");
    }
    return reply
      .status(problem.status)
      .type("application/problem+json")
      .send(problem.toProblemDetails(request.id, options.config.errorBaseUrl));
  });

  app.get(
    "/health/live",
    {
      schema: {
        response: {
          200: z.object({ status: z.literal("LIVE"), process: z.literal("api") }),
        },
      },
    },
    () => ({ status: "LIVE" as const, process: "api" as const }),
  );

  app.get(
    "/health/ready",
    {
      schema: {
        response: {
          200: z.object({
            status: z.literal("READY"),
            database: z.literal("AVAILABLE"),
            capabilities: z.object({
              emailVerificationDelivery: z.enum(["AVAILABLE", "UNAVAILABLE"]),
            }),
          }),
          503: apiProblemSchema,
        },
      },
    },
    async () => {
      try {
        await checkDatabase(options.database.pool);
      } catch {
        throw new AppProblem({
          status: 503,
          code: "DATABASE_UNAVAILABLE",
          title: "Serviço indisponível",
          detail: "A dependência canônica não está disponível.",
        });
      }
      return {
        status: "READY" as const,
        database: "AVAILABLE" as const,
        capabilities: {
          emailVerificationDelivery: options.verificationDelivery.isConfigured()
            ? ("AVAILABLE" as const)
            : ("UNAVAILABLE" as const),
        },
      };
    },
  );

  app.post(
    "/v1/auth/register",
    {
      schema: {
        operationId: "registerUser",
        body: registerUserBodySchema,
        response: { 202: registerUserResponseSchema, 422: apiProblemSchema, 429: apiProblemSchema, 503: apiProblemSchema },
      },
    },
    async (request, reply) => {
      if (!options.verificationDelivery.isConfigured()) {
        throw new AppProblem({
          status: 503,
          code: "EMAIL_DELIVERY_UNAVAILABLE",
          title: "Verificação temporariamente indisponível",
          detail: "Não foi possível enviar a verificação. Tente novamente mais tarde.",
        });
      }
      const result = await identity.register(request.body, actorContext(request));
      if (result.recipientEmail && result.verificationToken) {
        await options.verificationDelivery.sendVerification({
          recipientEmail: result.recipientEmail,
          verificationToken: result.verificationToken,
        });
      }
      return reply.status(202).send({ registrationStatus: "PENDING_VERIFICATION" });
    },
  );

  app.post(
    "/v1/auth/email-verifications",
    {
      schema: {
        operationId: "verifyUserEmail",
        body: verifyUserEmailBodySchema,
        response: { 204: z.null(), 422: apiProblemSchema },
      },
    },
    async (request, reply) => {
      await identity.verifyEmail(request.body.token, actorContext(request));
      return reply.status(204).send(null);
    },
  );

  app.post(
    "/v1/auth/login",
    {
      schema: {
        operationId: "createSession",
        body: loginBodySchema,
        response: { 204: z.null(), 401: apiProblemSchema, 429: apiProblemSchema },
      },
    },
    async (request, reply) => {
      const session = await identity.login(
        request.body.email,
        request.body.password,
        actorContext(request),
      );
      reply.header(
        "set-cookie",
        createSessionCookie(session.sessionToken, options.config.sessionTtlSeconds, secureCookie),
      );
      return reply.status(204).send(null);
    },
  );

  app.delete(
    "/v1/auth/session",
    { schema: { operationId: "deleteCurrentSession" } },
    async (request, reply) => {
      const session = await optionalSession(request);
      if (session) {
        requireCsrf(request, options.config);
        await identity.revokeSession(
          parsePublicId("user", session.userId),
          session.sessionId,
          actorContext(request, session),
        );
      }
      reply.header("set-cookie", clearSessionCookie(secureCookie));
      return reply.status(204).send();
    },
  );

  app.get(
    "/v1/me/sessions",
    {
      schema: {
        operationId: "listCurrentUserSessions",
        response: { 200: sessionListResponseSchema, 401: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await requireSession(request);
      const result = await identity.listSessions(
        parsePublicId("user", session.userId),
        session.sessionId,
      );
      return {
        data: result.data.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          expiresAt: item.expiresAt.toISOString(),
        })),
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.delete(
    "/v1/me/sessions/:sessionId",
    {
      schema: {
        operationId: "revokeCurrentUserSession",
        params: z.object({ sessionId: sessionIdSchema }),
        response: { 204: z.null(), 401: apiProblemSchema },
      },
    },
    async (request, reply) => {
      const session = await requireSession(request);
      requireCsrf(request, options.config);
      await identity.revokeSession(
        parsePublicId("user", session.userId),
        parseUuid(request.params.sessionId),
        actorContext(request, session),
      );
      return reply.status(204).send(null);
    },
  );

  app.post(
    "/v1/seller-accounts",
    {
      schema: {
        operationId: "createSellerAccount",
        body: createSellerAccountBodySchema,
        response: { 201: sellerAccountSchema, 401: apiProblemSchema, 403: apiProblemSchema },
      },
    },
    async (request, reply) => {
      const session = await requireSession(request);
      requireCsrf(request, options.config);
      const result = await sellers.createSellerAccount(
        parsePublicId("user", session.userId),
        request.body,
        actorContext(request, session),
      );
      return reply.status(201).send(result);
    },
  );

  app.get(
    "/v1/me/seller-accounts",
    {
      schema: {
        operationId: "listCurrentUserSellerAccounts",
        response: { 200: sellerAccountListResponseSchema, 401: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await requireSession(request);
      const result = await sellers.listCurrentUserSellerAccounts(parsePublicId("user", session.userId));
      return { ...result, asOf: result.asOf.toISOString() };
    },
  );

  app.get(
    "/v1/seller-accounts/:sellerAccountId/members",
    {
      schema: {
        operationId: "listSellerAccountMembers",
        params: z.object({ sellerAccountId: sellerAccountIdSchema }),
        response: {
          200: sellerMemberListResponseSchema,
          401: apiProblemSchema,
          404: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await requireSession(request);
      const result = await sellers.listSellerAccountMembers(
        parsePublicId("user", session.userId),
        parsePublicId("sellerAccount", request.params.sellerAccountId),
      );
      return {
        data: result.data.map((member) => ({
          ...member,
          validFrom: member.validFrom.toISOString(),
          validUntil: member.validUntil?.toISOString() ?? null,
        })),
        asOf: result.asOf.toISOString(),
      };
    },
  );

  registerFinanceRoutes(app, {
    finance,
    providerRegistry: paymentProviderRegistry,
    payoutExecutionRegistry,
    requireSession,
    requireCsrf: (request) => {
      requireCsrf(request, options.config);
    },
  });

  registerCatalogRoutes(app, {
    catalog,
    assets,
    requireSession,
    requireCsrf: (request) => {
      requireCsrf(request, options.config);
    },
  });

  registerRetentionRoutes(app, {
    savedCarts,
    watchlist,
    reminders,
    consent: reminderConsent,
    catalog,
    requireSession,
    requireCsrf: (request) => {
      requireCsrf(request, options.config);
    },
  });

  registerOrderRoutes(app, {
    carts,
    orders,
    deliveries,
    requireSession,
    requireCsrf: (request) => {
      requireCsrf(request, options.config);
    },
  });

  registerProgressionRoutes(app, {
    progression,
    requireSession,
  });

  async function optionalSession(request: FastifyRequest) {
    const token = parseCookie(request.headers.cookie, sessionCookieName);
    return identity.authenticateSessionToken(token);
  }

  async function requireSession(request: FastifyRequest) {
    const session = await optionalSession(request);
    if (!session) {
      throw new AppProblem({
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
        title: "Entre para continuar",
        detail: "Uma sessão válida é necessária para acessar este recurso.",
      });
    }
    return session;
  }

  return app;
}

function normalizeError(error: unknown): AppProblem {
  if (error instanceof AppProblem) return error;
  if (error instanceof ZodError) {
    return validationProblem(
      error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    );
  }
  const fastifyValidation = z.object({
    validation: z.array(z.object({
      instancePath: z.string().optional(),
      message: z.string().optional(),
    })),
  }).safeParse(error);
  if (fastifyValidation.success) {
    return validationProblem(
      fastifyValidation.data.validation.map(
        (issue) => ({
          field: issue.instancePath?.replace(/^\//, "").replaceAll("/", ".") ?? "request",
          message: issue.message ?? "Valor inválido",
        }),
      ),
    );
  }
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const status = Number(error.statusCode);
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      const code = "code" in error ? String(error.code) : "";
      if (status === 413 || code === "FST_ERR_CTP_BODY_TOO_LARGE") {
        return new AppProblem({
          status: 413,
          code: "PAYLOAD_TOO_LARGE",
          title: "Conteúdo muito grande",
          detail: "Reduza o conteúdo enviado e tente novamente.",
        });
      }
      if (status === 415 || code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
        return new AppProblem({
          status: 415,
          code: "MEDIA_TYPE_NOT_SUPPORTED",
          title: "Formato não suportado",
          detail: "Envie o conteúdo usando um formato aceito pela rota.",
        });
      }
      return new AppProblem({
        status,
        code: "INVALID_REQUEST",
        title: "Solicitação inválida",
        detail: "A solicitação não pôde ser processada.",
      });
    }
  }
  return new AppProblem({
    status: 500,
    code: "INTERNAL_ERROR",
    title: "Erro interno",
    detail: "Não foi possível concluir a solicitação.",
  });
}

function requireCsrf(request: FastifyRequest, config: ApiConfig): void {
  const origin = request.headers.origin;
  const customHeader = request.headers["x-midas-csrf"];
  if (customHeader !== "1" || (origin && !config.corsAllowedOrigins.has(origin))) {
    throw new AppProblem({
      status: 403,
      code: "CSRF_CHECK_FAILED",
      title: "Solicitação não autorizada",
      detail: "Atualize a página e tente novamente.",
    });
  }
}
