import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { AppProblem } from "@midas/kernel";
import type {
  VerificationDeliveryMessage,
  VerificationDeliveryPort,
} from "@midas/identity";

export class UnavailableVerificationDelivery implements VerificationDeliveryPort {
  isConfigured(): boolean {
    return false;
  }

  sendVerification(): Promise<void> {
    return Promise.reject(emailDeliveryUnavailable());
  }
}

export class SmtpVerificationDelivery implements VerificationDeliveryPort {
  private readonly transporter: Transporter<SMTPTransport.SentMessageInfo>;

  constructor(
    private readonly config: {
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      password?: string;
      from: string;
      publicWebUrl: string;
      brandName: string;
    },
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user && config.password
        ? { auth: { user: config.user, pass: config.password } }
        : {}),
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  }

  isConfigured(): boolean {
    return true;
  }

  async sendVerification(message: VerificationDeliveryMessage): Promise<void> {
    const verificationUrl = new URL("/verificar-email", this.config.publicWebUrl);
    verificationUrl.searchParams.set("token", message.verificationToken);
    try {
      const result = await this.transporter.sendMail({
        from: this.config.from,
        to: message.recipientEmail,
        subject: `Confirme seu cadastro na ${this.config.brandName}`,
        text: `Confirme seu cadastro na ${this.config.brandName} acessando: ${verificationUrl.toString()}`,
      });
      const accepted = result.accepted.some((address) =>
        (typeof address === "string" ? address : address.address).toLowerCase() ===
          message.recipientEmail,
      );
      if (!accepted) {
        throw new Error("SMTP não aceitou o destinatário");
      }
    } catch (error) {
      throw emailDeliveryUnavailable(error);
    }
  }
}

function emailDeliveryUnavailable(cause?: unknown): AppProblem {
  const problem = new AppProblem({
    status: 503,
    code: "EMAIL_DELIVERY_UNAVAILABLE",
    title: "Verificação temporariamente indisponível",
    detail: "Não foi possível enviar a verificação. Tente novamente mais tarde.",
  });
  if (cause) Object.defineProperty(problem, "cause", { value: cause, enumerable: false });
  return problem;
}
