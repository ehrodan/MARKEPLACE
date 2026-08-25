import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  apiProblemSchema,
  confirmPayoutBodySchema,
  completePayoutBodySchema,
  createPaymentResolutionBodySchema,
  createPayoutRequestBodySchema,
  decidePaymentResolutionBodySchema,
  financePaymentListSchema,
  financeStatusQuerySchema,
  financeUuidSchema,
  paymentResolutionCaseListSchema,
  paymentResolutionCaseSchema,
  payoutRequestListSchema,
  payoutRequestSchema,
  payoutCapabilityQuerySchema,
  payoutCapabilitySchema,
  providerCapabilityQuerySchema,
  providerCapabilitySchema,
  providerWebhookAckSchema,
  sellerAccountIdSchema,
  sellerBalanceQuerySchema,
  sellerBalanceSchema,
} from "@midas/contracts";
import type {
  FinanceService,
  PaymentProviderRegistry,
  PayoutExecutionCapabilityRegistry,
} from "@midas/finance";
import type { AuthenticatedSession } from "@midas/identity";
import { AppProblem, parsePublicId, parseUuid, toPublicId } from "@midas/kernel";
import { actorContext } from "./http/request-context.js";

export type RegisterFinanceRoutesOptions = {
  finance: FinanceService;
  providerRegistry: PaymentProviderRegistry;
  payoutExecutionRegistry: PayoutExecutionCapabilityRegistry;
  requireSession(request: FastifyRequest): Promise<AuthenticatedSession>;
  requireCsrf(request: FastifyRequest): void;
};

export function registerFinanceRoutes(
  app: FastifyInstance,
  options: RegisterFinanceRoutesOptions,
): void {
  app.get(
    "/v1/finance/provider-capability",
    {
      schema: {
        operationId: "getPaymentProviderCapability",
        querystring: providerCapabilityQuerySchema,
        response: { 200: providerCapabilitySchema },
      },
    },
    (request) => {
      const query = providerCapabilityQuerySchema.parse(request.query);
      return options.providerRegistry.capability(query.providerCode);
    },
  );

  app.post(
    "/v1/provider-webhooks/:providerCode",
    {
      schema: {
        operationId: "receivePaymentProviderWebhook",
        params: z.object({ providerCode: z.string().min(1).max(120) }),
        body: z.unknown(),
        response: {
          202: providerWebhookAckSchema,
          409: apiProblemSchema,
          422: apiProblemSchema,
          503: apiProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const params = z.object({ providerCode: z.string().min(1).max(120) }).parse(request.params);
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
      if (!rawBody) {
        throw new AppProblem({
          status: 503,
          code: "PROVIDER_RAW_BODY_UNAVAILABLE",
          title: "Webhook indisponível",
          detail: "A captura dos bytes originais é obrigatória para validar a assinatura do provider.",
        });
      }
      const result = await options.finance.processProviderWebhook(
        options.providerRegistry,
        params.providerCode,
        { rawBody, headers: request.headers },
        actorContext(request),
      );
      return reply.status(202).send(result);
    },
  );

  app.get(
    "/v1/finance/payout-capability",
    {
      schema: {
        operationId: "getPayoutExecutionCapability",
        querystring: payoutCapabilityQuerySchema,
        response: { 200: payoutCapabilitySchema },
      },
    },
    (request) => {
      const query = payoutCapabilityQuerySchema.parse(request.query);
      return options.payoutExecutionRegistry.capability(query);
    },
  );

  app.get(
    "/v1/me/payments",
    {
      schema: {
        operationId: "listCurrentBuyerPayments",
        response: { 200: financePaymentListSchema, 401: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const result = await options.finance.listBuyerPayments(parsePublicId("user", session.userId));
      return {
        data: result.data.map(serializePayment),
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.get(
    "/v1/seller-accounts/:sellerAccountId/finance/balance",
    {
      schema: {
        operationId: "getSellerFinancialBalance",
        params: z.object({ sellerAccountId: sellerAccountIdSchema }),
        querystring: sellerBalanceQuerySchema,
        response: { 200: sellerBalanceSchema, 401: apiProblemSchema, 404: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const params = z.object({ sellerAccountId: sellerAccountIdSchema }).parse(request.params);
      const query = sellerBalanceQuerySchema.parse(request.query);
      const result = await options.finance.getSellerBalance(
        parsePublicId("user", session.userId),
        parsePublicId("sellerAccount", params.sellerAccountId),
        query.currency,
      );
      return {
        ...result,
        sellerAccountId: toPublicId("sellerAccount", result.sellerAccountId),
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.get(
    "/v1/seller-accounts/:sellerAccountId/payouts",
    {
      schema: {
        operationId: "listSellerPayouts",
        params: z.object({ sellerAccountId: sellerAccountIdSchema }),
        response: { 200: payoutRequestListSchema, 401: apiProblemSchema, 404: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const params = z.object({ sellerAccountId: sellerAccountIdSchema }).parse(request.params);
      const result = await options.finance.listSellerPayouts(
        parsePublicId("user", session.userId),
        parsePublicId("sellerAccount", params.sellerAccountId),
      );
      return serializePayoutList(result);
    },
  );

  app.post(
    "/v1/seller-accounts/:sellerAccountId/payouts",
    {
      schema: {
        operationId: "requestSellerPayout",
        params: z.object({ sellerAccountId: sellerAccountIdSchema }),
        body: createPayoutRequestBodySchema,
        response: {
          201: payoutRequestSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
          422: apiProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = z.object({ sellerAccountId: sellerAccountIdSchema }).parse(request.params);
      const body = createPayoutRequestBodySchema.parse(request.body);
      const userId = parsePublicId("user", session.userId);
      const result = await options.finance.requestPayout(
        userId,
        parsePublicId("sellerAccount", params.sellerAccountId),
        {
          amountMinor: BigInt(body.amountMinor),
          currency: body.currency,
          destinationCountry: body.destinationCountry,
          idempotencyKey: requireIdempotencyKey(request),
        },
        actorContext(request, session),
      );
      return reply.status(201).send(serializePayout(result));
    },
  );

  app.get(
    "/v1/admin/payment-resolution-cases",
    {
      schema: {
        operationId: "listPaymentResolutionCases",
        querystring: financeStatusQuerySchema,
        response: { 200: paymentResolutionCaseListSchema, 401: apiProblemSchema, 403: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const query = financeStatusQuerySchema.parse(request.query);
      const result = await options.finance.listResolutionCases(
        parsePublicId("user", session.userId),
        query.status,
      );
      return {
        data: result.data.map(serializeResolution),
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.post(
    "/v1/admin/payments/:paymentId/resolution-cases",
    {
      schema: {
        operationId: "createPaymentResolutionCase",
        params: z.object({ paymentId: financeUuidSchema }),
        body: createPaymentResolutionBodySchema,
        response: {
          201: paymentResolutionCaseSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
          422: apiProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = z.object({ paymentId: financeUuidSchema }).parse(request.params);
      const body = createPaymentResolutionBodySchema.parse(request.body);
      const userId = parsePublicId("user", session.userId);
      const result = await options.finance.createResolutionCase(
        userId,
        parseUuid(params.paymentId),
        body,
        actorContext(request, session),
      );
      return reply.status(201).send(serializeResolution(result));
    },
  );

  app.post(
    "/v1/admin/payment-resolution-cases/:resolutionCaseId/decisions",
    {
      schema: {
        operationId: "decidePaymentResolutionCase",
        params: z.object({ resolutionCaseId: financeUuidSchema }),
        body: decidePaymentResolutionBodySchema,
        response: {
          200: paymentResolutionCaseSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
          422: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = z.object({ resolutionCaseId: financeUuidSchema }).parse(request.params);
      const body = decidePaymentResolutionBodySchema.parse(request.body);
      const result = await options.finance.decideResolutionCase(
        options.providerRegistry,
        parsePublicId("user", session.userId),
        parseUuid(params.resolutionCaseId),
        body,
        actorContext(request, session),
      );
      return serializeResolution(result);
    },
  );

  app.get(
    "/v1/admin/payouts",
    {
      schema: {
        operationId: "listAdminPayouts",
        querystring: financeStatusQuerySchema,
        response: { 200: payoutRequestListSchema, 401: apiProblemSchema, 403: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const query = financeStatusQuerySchema.parse(request.query);
      const result = await options.finance.listAdminPayouts(
        parsePublicId("user", session.userId),
        query.status,
      );
      return serializePayoutList(result);
    },
  );

  app.post(
    "/v1/admin/payouts/:payoutRequestId/claim",
    {
      schema: {
        operationId: "claimAdminPayout",
        params: z.object({ payoutRequestId: financeUuidSchema }),
        response: {
          200: payoutRequestSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = z.object({ payoutRequestId: financeUuidSchema }).parse(request.params);
      const result = await options.finance.claimPayout(
        parsePublicId("user", session.userId),
        parseUuid(params.payoutRequestId),
        actorContext(request, session),
      );
      return serializePayout(result);
    },
  );

  app.post(
    "/v1/admin/payouts/:payoutRequestId/approve",
    {
      schema: {
        operationId: "approveAdminPayout",
        params: z.object({ payoutRequestId: financeUuidSchema }),
        response: {
          200: payoutRequestSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = z.object({ payoutRequestId: financeUuidSchema }).parse(request.params);
      const result = await options.finance.approvePayout(
        parsePublicId("user", session.userId),
        parseUuid(params.payoutRequestId),
        actorContext(request, session),
      );
      return serializePayout(result);
    },
  );

  app.post(
    "/v1/admin/payouts/:payoutRequestId/executions",
    {
      schema: {
        operationId: "registerExternalAdminPayoutExecution",
        params: z.object({ payoutRequestId: financeUuidSchema }),
        body: completePayoutBodySchema,
        response: {
          200: payoutRequestSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
          422: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = z.object({ payoutRequestId: financeUuidSchema }).parse(request.params);
      const body = completePayoutBodySchema.parse(request.body);
      const result = await options.finance.registerExternalPayoutExecution(
        options.payoutExecutionRegistry,
        parsePublicId("user", session.userId),
        parseUuid(params.payoutRequestId),
        {
          externalReference: body.externalReference,
          evidenceLocator: body.evidenceLocator,
          evidenceSha256: body.evidenceSha256,
          idempotencyKey: requireIdempotencyKey(request),
        },
        actorContext(request, session),
      );
      return serializePayout(result);
    },
  );

  app.post(
    "/v1/admin/payouts/:payoutRequestId/confirmations",
    {
      schema: {
        operationId: "confirmExternalAdminPayout",
        params: z.object({ payoutRequestId: financeUuidSchema }),
        body: confirmPayoutBodySchema,
        response: {
          200: payoutRequestSchema,
          401: apiProblemSchema,
          403: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
          422: apiProblemSchema,
          503: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = z.object({ payoutRequestId: financeUuidSchema }).parse(request.params);
      const body = confirmPayoutBodySchema.parse(request.body);
      const result = await options.finance.confirmExternalPayout(
        options.payoutExecutionRegistry,
        parsePublicId("user", session.userId),
        parseUuid(params.payoutRequestId),
        { ...body, idempotencyKey: requireIdempotencyKey(request) },
        actorContext(request, session),
      );
      return serializePayout(result);
    },
  );
}

function serializePayment(payment: Awaited<ReturnType<FinanceService["listBuyerPayments"]>>["data"][number]) {
  return {
    ...payment,
    buyerUserId: toPublicId("user", payment.buyerUserId),
    sellerAccountId: toPublicId("sellerAccount", payment.sellerAccountId),
    settledAt: payment.settledAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}

function serializeResolution(
  resolution: Awaited<ReturnType<FinanceService["createResolutionCase"]>>,
) {
  return {
    ...resolution,
    createdByUserId: toPublicId("user", resolution.createdByUserId),
    reviewedByUserId: resolution.reviewedByUserId
      ? toPublicId("user", resolution.reviewedByUserId)
      : null,
    createdAt: resolution.createdAt.toISOString(),
    reviewedAt: resolution.reviewedAt?.toISOString() ?? null,
  };
}

function serializePayout(payout: Awaited<ReturnType<FinanceService["requestPayout"]>>) {
  return {
    ...payout,
    sellerAccountId: toPublicId("sellerAccount", payout.sellerAccountId),
    requestedByUserId: toPublicId("user", payout.requestedByUserId),
    claimedByUserId: payout.claimedByUserId ? toPublicId("user", payout.claimedByUserId) : null,
    approvedByUserId: payout.approvedByUserId ? toPublicId("user", payout.approvedByUserId) : null,
    completedByUserId: payout.completedByUserId
      ? toPublicId("user", payout.completedByUserId)
      : null,
    claimedAt: payout.claimedAt?.toISOString() ?? null,
    approvedAt: payout.approvedAt?.toISOString() ?? null,
    completedAt: payout.completedAt?.toISOString() ?? null,
    createdAt: payout.createdAt.toISOString(),
  };
}

function serializePayoutList(
  result: Awaited<ReturnType<FinanceService["listSellerPayouts"]>>,
) {
  return {
    data: result.data.map(serializePayout),
    asOf: result.asOf.toISOString(),
  };
}

function requireIdempotencyKey(request: FastifyRequest): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string" || value.trim().length < 16) {
    throw new AppProblem({
      status: 422,
      code: "IDEMPOTENCY_KEY_REQUIRED",
      title: "Chave de idempotência obrigatória",
      detail: "Envie o header idempotency-key com ao menos 16 caracteres.",
    });
  }
  return value;
}
