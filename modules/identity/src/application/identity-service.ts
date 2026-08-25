import { and, asc, eq, gt, isNull } from "drizzle-orm";
import type { MidasDatabase } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendAuditEvent } from "@midas/administration-audit";
import { appendOutboxEvent } from "@midas/eventing";
import {
  AppProblem,
  createSecretToken,
  createUuidV7,
  hashPassword,
  hashSecretToken,
  toPublicId,
  verifyPassword,
  type ActorContext,
  type PublicId,
} from "@midas/kernel";
import { assertCanVerifyUser, nextVerifiedUserStatus, normalizeEmail } from "../domain/user.js";
import {
  authRateLimits,
  credentials,
  emailVerificationChallenges,
  sessions,
  users,
} from "../adapters/postgres/schema.js";

export type RegisterUserInput = {
  email: string;
  password: string;
  displayName: string;
  acceptedTermsVersion: string;
};

export type RegistrationChallenge = {
  registrationStatus: "PENDING_VERIFICATION";
  recipientEmail?: string;
  verificationToken?: string;
};

export type AuthenticatedSession = {
  userId: PublicId<"user">;
  sessionId: string;
  displayName: string;
  expiresAt: Date;
};

export type NewSession = AuthenticatedSession & { sessionToken: string };

const authenticationFailed = () =>
  new AppProblem({
    status: 401,
    code: "AUTHENTICATION_FAILED",
    title: "Não foi possível entrar",
    detail: "Confira suas credenciais e tente novamente.",
  });

// Hash Argon2id válido e não secreto usado para manter o custo de login equivalente
// quando o e-mail não existe. Nunca corresponde a uma credencial cadastrável.
const nonexistentUserPasswordHash =
  "$argon2id$v=19$m=19456,t=2,p=1$XcXk/uc1c7ETFxb040WMxA$/C+Y1sjviB2KyqMtlpeRlcyx6H6E2V8HjjyMLt6nF1s";

export class IdentityService {
  constructor(
    private readonly db: MidasDatabase,
    private readonly options: {
      sessionTtlSeconds: number;
      verificationTtlSeconds: number;
      authRateLimitAttempts: number;
      authRateLimitWindowSeconds: number;
    },
  ) {}

  async register(input: RegisterUserInput, actor: ActorContext): Promise<RegistrationChallenge> {
    const emailNormalized = normalizeEmail(input.email);
    await this.consumeAuthRateLimit(`register:${actor.ipPrefix ?? "unknown"}:${emailNormalized}`);
    const encodedPasswordHash = await hashPassword(input.password);
    const verificationToken = createSecretToken();
    const tokenHash = hashSecretToken(verificationToken);
    const now = new Date();

    return withSerializableTransaction(this.db, async (transaction) => {
      const existing = await transaction
        .select()
        .from(users)
        .where(eq(users.emailNormalized, emailNormalized))
        .limit(1)
        .for("update");

      if (existing[0]?.userStatus === "ACTIVE" || existing[0]?.userStatus === "SUSPENDED") {
        return { registrationStatus: "PENDING_VERIFICATION" };
      }

      let userId: string;
      let aggregateVersion: number;
      if (existing[0]) {
        userId = existing[0].userId;
        aggregateVersion = existing[0].version + 1;
        await transaction
          .update(users)
          .set({
            displayName: input.displayName.trim(),
            acceptedTermsVersion: input.acceptedTermsVersion,
            acceptedTermsAt: now,
            updatedAt: now,
            version: aggregateVersion,
          })
          .where(eq(users.userId, userId));
        await transaction
          .update(credentials)
          .set({ retiredAt: now })
          .where(
            and(
              eq(credentials.userId, userId),
              eq(credentials.credentialType, "PASSWORD"),
              isNull(credentials.retiredAt),
            ),
          );
        await transaction.insert(credentials).values({
          credentialId: createUuidV7(),
          userId,
          credentialType: "PASSWORD",
          passwordHash: encodedPasswordHash,
          createdAt: now,
        });
        await transaction
          .update(emailVerificationChallenges)
          .set({ invalidatedAt: now })
          .where(
            and(
              eq(emailVerificationChallenges.userId, userId),
              isNull(emailVerificationChallenges.consumedAt),
              isNull(emailVerificationChallenges.invalidatedAt),
            ),
          );
      } else {
        userId = createUuidV7();
        aggregateVersion = 1;
        await transaction.insert(users).values({
          userId,
          emailNormalized,
          displayName: input.displayName.trim(),
          userStatus: "PENDING_VERIFICATION",
          acceptedTermsVersion: input.acceptedTermsVersion,
          acceptedTermsAt: now,
          version: aggregateVersion,
          createdAt: now,
          updatedAt: now,
        });
        await transaction.insert(credentials).values({
          credentialId: createUuidV7(),
          userId,
          credentialType: "PASSWORD",
          passwordHash: encodedPasswordHash,
          createdAt: now,
        });

        await appendOutboxEvent(
          transaction,
          {
            eventType: "identity.user.registered.v1",
            aggregateType: "User",
            aggregateId: userId,
            aggregateVersion,
            ownerModule: "identity",
            dataClassification: "INTERNAL",
            payload: {
              userId: toPublicId("user", userId),
              userStatus: "PENDING_VERIFICATION",
            },
          },
          actor,
        );
      }

      await transaction.insert(emailVerificationChallenges).values({
        challengeId: createUuidV7(),
        userId,
        tokenHash,
        expiresAt: new Date(now.getTime() + this.options.verificationTtlSeconds * 1_000),
        createdAt: now,
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "identity.user.verification_requested.v1",
          aggregateType: "User",
          aggregateId: userId,
          aggregateVersion,
          ownerModule: "identity",
          dataClassification: "INTERNAL",
          payload: { userId: toPublicId("user", userId) },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "identity.user.register",
          resourceType: "User",
          resourceId: userId,
          afterRedacted: { userStatus: "PENDING_VERIFICATION" },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );

      return {
        registrationStatus: "PENDING_VERIFICATION",
        recipientEmail: emailNormalized,
        verificationToken,
      };
    });
  }

  async verifyEmail(token: string, actor: ActorContext): Promise<void> {
    const tokenHash = hashSecretToken(token);
    const now = new Date();
    await withSerializableTransaction(this.db, async (transaction) => {
      const matches = await transaction
        .select({
          challengeId: emailVerificationChallenges.challengeId,
          userId: emailVerificationChallenges.userId,
          expiresAt: emailVerificationChallenges.expiresAt,
          consumedAt: emailVerificationChallenges.consumedAt,
          invalidatedAt: emailVerificationChallenges.invalidatedAt,
          userStatus: users.userStatus,
          version: users.version,
        })
        .from(emailVerificationChallenges)
        .innerJoin(users, eq(users.userId, emailVerificationChallenges.userId))
        .where(eq(emailVerificationChallenges.tokenHash, tokenHash))
        .limit(1)
        .for("update");
      const challenge = matches[0];
      if (
        !challenge ||
        challenge.consumedAt ||
        challenge.invalidatedAt ||
        challenge.expiresAt <= now
      ) {
        throw new AppProblem({
          status: 422,
          code: "EMAIL_VERIFICATION_INVALID",
          title: "Verificação inválida",
          detail: "O link é inválido ou expirou. Solicite uma nova verificação.",
        });
      }

      assertCanVerifyUser(challenge.userStatus as "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED");
      const nextVersion = challenge.version + 1;
      await transaction
        .update(emailVerificationChallenges)
        .set({ consumedAt: now })
        .where(eq(emailVerificationChallenges.challengeId, challenge.challengeId));
      await transaction
        .update(users)
        .set({
          userStatus: nextVerifiedUserStatus(
            challenge.userStatus as "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED",
          ),
          version: nextVersion,
          updatedAt: now,
        })
        .where(eq(users.userId, challenge.userId));

      await appendOutboxEvent(
        transaction,
        {
          eventType: "identity.user.email_verified.v1",
          aggregateType: "User",
          aggregateId: challenge.userId,
          aggregateVersion: nextVersion,
          ownerModule: "identity",
          dataClassification: "INTERNAL",
          payload: { userId: toPublicId("user", challenge.userId), userStatus: "ACTIVE" },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "identity.user.verify_email",
          resourceType: "User",
          resourceId: challenge.userId,
          beforeRedacted: { userStatus: challenge.userStatus },
          afterRedacted: { userStatus: "ACTIVE" },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });
  }

  async login(
    email: string,
    password: string,
    actor: ActorContext,
  ): Promise<NewSession> {
    const emailNormalized = normalizeEmail(email);
    await this.consumeAuthRateLimit(`login:${actor.ipPrefix ?? "unknown"}:${emailNormalized}`);
    const rows = await this.db
      .select({
        userId: users.userId,
        displayName: users.displayName,
        userStatus: users.userStatus,
        passwordHash: credentials.passwordHash,
      })
      .from(users)
      .innerJoin(
        credentials,
        and(
          eq(credentials.userId, users.userId),
          eq(credentials.credentialType, "PASSWORD"),
          isNull(credentials.retiredAt),
        ),
      )
      .where(eq(users.emailNormalized, emailNormalized))
      .limit(1);
    const user = rows[0];
    const valid = await verifyPassword(user?.passwordHash ?? nonexistentUserPasswordHash, password);
    if (!user || !valid || user.userStatus !== "ACTIVE") {
      await this.auditFailedLogin(actor);
      throw authenticationFailed();
    }

    const sessionId = createUuidV7();
    const sessionToken = createSecretToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.options.sessionTtlSeconds * 1_000);
    await withSerializableTransaction(this.db, async (transaction) => {
      await transaction.insert(sessions).values({
        sessionId,
        userId: user.userId,
        tokenHash: hashSecretToken(sessionToken),
        createdAt: now,
        expiresAt,
        lastSeenAt: now,
      });
      await appendOutboxEvent(
        transaction,
        {
          eventType: "identity.session.started.v1",
          aggregateType: "Session",
          aggregateId: sessionId,
          aggregateVersion: 1,
          ownerModule: "identity",
          dataClassification: "INTERNAL",
          payload: { userId: toPublicId("user", user.userId) },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "identity.session.create",
          resourceType: "User",
          resourceId: user.userId,
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });

    return {
      userId: toPublicId("user", user.userId),
      displayName: user.displayName,
      sessionId,
      sessionToken,
      expiresAt,
    };
  }

  async authenticateSessionToken(token: string | undefined): Promise<AuthenticatedSession | null> {
    if (!token) return null;
    const now = new Date();
    const rows = await this.db
      .select({
        sessionId: sessions.sessionId,
        userId: users.userId,
        displayName: users.displayName,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.userId, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, hashSecretToken(token)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          eq(users.userStatus, "ACTIVE"),
        ),
      )
      .limit(1);
    const session = rows[0];
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      userId: toPublicId("user", session.userId),
      displayName: session.displayName,
      expiresAt: session.expiresAt,
    };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const rows = await this.db
      .select({
        sessionId: sessions.sessionId,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .orderBy(asc(sessions.createdAt));
    const asOf = new Date();
    return {
      data: rows.map((row) => ({ ...row, current: row.sessionId === currentSessionId })),
      asOf,
    };
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    actor: ActorContext,
  ): Promise<void> {
    const now = new Date();
    await withSerializableTransaction(this.db, async (transaction) => {
      const revoked = await transaction
        .update(sessions)
        .set({ revokedAt: now })
        .where(
          and(
            eq(sessions.sessionId, sessionId),
            eq(sessions.userId, userId),
            isNull(sessions.revokedAt),
          ),
        )
        .returning({ sessionId: sessions.sessionId });
      if (!revoked[0]) return;
      await appendOutboxEvent(
        transaction,
        {
          eventType: "identity.session.revoked.v1",
          aggregateType: "Session",
          aggregateId: sessionId,
          aggregateVersion: 1,
          ownerModule: "identity",
          dataClassification: "INTERNAL",
          payload: { userId: toPublicId("user", userId) },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "identity.session.revoke",
          resourceType: "User",
          resourceId: userId,
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });
  }

  private async consumeAuthRateLimit(key: string): Promise<void> {
    const keyHash = hashSecretToken(key);
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.options.authRateLimitWindowSeconds * 1_000);
    await withSerializableTransaction(this.db, async (transaction) => {
      const rows = await transaction
        .select()
        .from(authRateLimits)
        .where(eq(authRateLimits.rateLimitKeyHash, keyHash))
        .limit(1)
        .for("update");
      const current = rows[0];
      if (!current || current.windowStartedAt <= windowStart) {
        await transaction
          .insert(authRateLimits)
          .values({ rateLimitKeyHash: keyHash, windowStartedAt: now, attemptCount: 1, updatedAt: now })
          .onConflictDoUpdate({
            target: authRateLimits.rateLimitKeyHash,
            set: { windowStartedAt: now, attemptCount: 1, updatedAt: now },
          });
        return;
      }
      if (current.attemptCount >= this.options.authRateLimitAttempts) {
        throw new AppProblem({
          status: 429,
          code: "AUTH_RATE_LIMITED",
          title: "Muitas tentativas",
          detail: "Aguarde antes de tentar novamente.",
        });
      }
      await transaction
        .update(authRateLimits)
        .set({ attemptCount: current.attemptCount + 1, updatedAt: now })
        .where(eq(authRateLimits.rateLimitKeyHash, keyHash));
    });
  }

  private async auditFailedLogin(actor: ActorContext): Promise<void> {
    await withSerializableTransaction(this.db, async (transaction) => {
      await appendAuditEvent(
        transaction,
        {
          action: "identity.session.login_failed",
          resourceType: "User",
          reasonCode: "AUTHENTICATION_FAILED",
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });
  }
}
