import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  accountProgressionSchema,
  apiProblemSchema,
  sellerAccountIdSchema,
} from "@midas/contracts";
import type { AuthenticatedSession } from "@midas/identity";
import { parsePublicId } from "@midas/kernel";
import type { ProgressionService } from "@midas/progression";

export type RegisterProgressionRoutesOptions = {
  progression: ProgressionService;
  requireSession(request: FastifyRequest): Promise<AuthenticatedSession>;
};

export function registerProgressionRoutes(
  app: FastifyInstance,
  options: RegisterProgressionRoutesOptions,
): void {
  app.get(
    "/v1/seller-accounts/:sellerAccountId/progression",
    {
      schema: {
        operationId: "getSellerAccountProgression",
        params: z.object({ sellerAccountId: sellerAccountIdSchema }),
        response: {
          200: accountProgressionSchema,
          401: apiProblemSchema,
          404: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const params = z.object({ sellerAccountId: sellerAccountIdSchema }).parse(request.params);
      const result = await options.progression.getSellerProgression(
        parsePublicId("user", session.userId),
        parsePublicId("sellerAccount", params.sellerAccountId),
      );
      return {
        levelAssignment: {
          ...result.levelAssignment,
          qualifiedLifetimeGmvMinor: String(result.levelAssignment.qualifiedLifetimeGmvMinor),
          currentLevelMinInclusiveMinor: String(
            result.levelAssignment.currentLevelMinInclusiveMinor,
          ),
          nextLevelMinInclusiveMinor: result.levelAssignment.nextLevelMinInclusiveMinor === null
            ? null
            : String(result.levelAssignment.nextLevelMinInclusiveMinor),
        },
        badgeAwards: result.badgeAwards.map((badge) => ({
          ...badge,
          awardedAt: badge.awardedAt.toISOString(),
        })),
        rewardAwards: result.rewardAwards.map((reward) => ({
          ...reward,
          awardedAt: reward.awardedAt.toISOString(),
          fulfilledAt: reward.fulfilledAt?.toISOString() ?? null,
        })),
        asOf: result.asOf.toISOString(),
        freshness: result.freshness,
      };
    },
  );
}
