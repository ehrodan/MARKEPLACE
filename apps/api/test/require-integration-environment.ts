const integrationDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!integrationDatabaseUrl?.startsWith("postgresql://")) {
  throw new Error(
    "TEST_DATABASE_URL ou DATABASE_URL PostgreSQL é obrigatório; a suíte não usa mock.",
  );
}
process.env.TEST_DATABASE_URL = integrationDatabaseUrl;
