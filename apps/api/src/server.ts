import { createDatabase } from "@midas/database";
import { buildApi } from "./app.js";
import { loadApiConfig } from "./config.js";
import {
  SmtpVerificationDelivery,
  UnavailableVerificationDelivery,
} from "./adapters/smtp-verification-delivery.js";

const config = loadApiConfig();
const database = createDatabase(config.databaseUrl);
const verificationDelivery = config.smtp
  ? new SmtpVerificationDelivery({
      ...config.smtp,
      publicWebUrl: config.publicWebUrl,
      brandName: config.brandName,
    })
  : new UnavailableVerificationDelivery();
const app = buildApi({ config, database, verificationDelivery });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await database.close();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await database.close();
  process.exitCode = 1;
}
