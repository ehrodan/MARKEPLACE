import { AppProblem } from "@midas/kernel";

export type UserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";

export function normalizeEmail(email: string): string {
  return email.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

export function assertCanVerifyUser(status: UserStatus): void {
  if (status === "SUSPENDED") {
    throw new AppProblem({
      status: 409,
      code: "USER_STATE_CONFLICT",
      title: "Conta indisponível",
      detail: "A conta não pode ser verificada no estado atual.",
    });
  }
}

export function nextVerifiedUserStatus(status: UserStatus): UserStatus {
  assertCanVerifyUser(status);
  return "ACTIVE";
}
