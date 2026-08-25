export type VerificationDeliveryMessage = {
  recipientEmail: string;
  verificationToken: string;
};

export interface VerificationDeliveryPort {
  isConfigured(): boolean;
  sendVerification(message: VerificationDeliveryMessage): Promise<void>;
}
