import { z } from "zod";

const optionalNonEmpty = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3_001),
    DATABASE_URL: z.url().startsWith("postgresql://"),
    PUBLIC_WEB_URL: z.url().default("http://localhost:3000"),
    BRAND_NAME: z.string().trim().min(1).max(80).default("OCHPOCH MARKET"),
    ERROR_BASE_URL: z.url().default("https://errors.midas.local"),
    CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
    SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(86_400),
    VERIFICATION_TTL_SECONDS: z.coerce.number().int().min(300).max(172_800).default(3_600),
    AUTH_RATE_LIMIT_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(8),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    SMTP_HOST: optionalNonEmpty,
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1_025),
    SMTP_SECURE: z.enum(["true", "false"]).default("false"),
    SMTP_USER: optionalNonEmpty,
    SMTP_PASSWORD: optionalNonEmpty,
    SMTP_FROM: optionalNonEmpty,
    PSP_PROVIDER: z.enum(["stripe", "mercadopago", "none"]).default("none"),
    STRIPE_SECRET_KEY: optionalNonEmpty,
    STRIPE_WEBHOOK_SECRET: optionalNonEmpty,
    MERCADOPAGO_ACCESS_TOKEN: optionalNonEmpty,
    MERCADOPAGO_WEBHOOK_SECRET: optionalNonEmpty,
  })
  .superRefine((value, context) => {
    const smtpFields = [value.SMTP_HOST, value.SMTP_FROM];
    if (smtpFields.some(Boolean) && smtpFields.some((field) => !field)) {
      context.addIssue({
        code: "custom",
        message: "SMTP_HOST e SMTP_FROM devem ser configurados em conjunto",
        path: ["SMTP_HOST"],
      });
    }
    if ((value.SMTP_USER && !value.SMTP_PASSWORD) || (!value.SMTP_USER && value.SMTP_PASSWORD)) {
      context.addIssue({
        code: "custom",
        message: "SMTP_USER e SMTP_PASSWORD devem ser configurados em conjunto",
        path: ["SMTP_USER"],
      });
    }
  });

export type ApiConfig = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  databaseUrl: string;
  publicWebUrl: string;
  brandName: string;
  errorBaseUrl: string;
  corsAllowedOrigins: Set<string>;
  sessionTtlSeconds: number;
  verificationTtlSeconds: number;
  authRateLimitAttempts: number;
  authRateLimitWindowSeconds: number;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
  };
  pspProvider: "stripe" | "mercadopago" | "none";
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  mercadopagoAccessToken?: string;
  mercadopagoWebhookSecret?: string;
};

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = environmentSchema.parse({
    ...environment,
    PORT: environment.PORT ?? environment.API_PORT,
    PUBLIC_WEB_URL: environment.PUBLIC_WEB_URL ?? environment.WEB_ORIGIN,
    CORS_ALLOWED_ORIGINS: environment.CORS_ALLOWED_ORIGINS ?? environment.WEB_ORIGIN,
    BRAND_NAME: environment.BRAND_NAME ?? environment.NEXT_PUBLIC_BRAND_NAME,
  });
  const smtp = parsed.SMTP_HOST && parsed.SMTP_FROM
    ? {
        host: parsed.SMTP_HOST,
        port: parsed.SMTP_PORT,
        secure: parsed.SMTP_SECURE === "true",
        ...(parsed.SMTP_USER ? { user: parsed.SMTP_USER } : {}),
        ...(parsed.SMTP_PASSWORD ? { password: parsed.SMTP_PASSWORD } : {}),
        from: parsed.SMTP_FROM,
      }
    : undefined;
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    publicWebUrl: parsed.PUBLIC_WEB_URL,
    brandName: parsed.BRAND_NAME,
    errorBaseUrl: parsed.ERROR_BASE_URL,
    corsAllowedOrigins: new Set(
      parsed.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    ),
    sessionTtlSeconds: parsed.SESSION_TTL_SECONDS,
    verificationTtlSeconds: parsed.VERIFICATION_TTL_SECONDS,
    authRateLimitAttempts: parsed.AUTH_RATE_LIMIT_ATTEMPTS,
    authRateLimitWindowSeconds: parsed.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    ...(smtp ? { smtp } : {}),
    pspProvider: parsed.PSP_PROVIDER,
    ...(parsed.STRIPE_SECRET_KEY ? { stripeSecretKey: parsed.STRIPE_SECRET_KEY } : {}),
    ...(parsed.STRIPE_WEBHOOK_SECRET ? { stripeWebhookSecret: parsed.STRIPE_WEBHOOK_SECRET } : {}),
    ...(parsed.MERCADOPAGO_ACCESS_TOKEN ? { mercadopagoAccessToken: parsed.MERCADOPAGO_ACCESS_TOKEN } : {}),
    ...(parsed.MERCADOPAGO_WEBHOOK_SECRET ? { mercadopagoWebhookSecret: parsed.MERCADOPAGO_WEBHOOK_SECRET } : {}),
  };
}
