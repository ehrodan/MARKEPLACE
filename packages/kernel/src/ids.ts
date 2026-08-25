import { randomBytes } from "node:crypto";
import { z } from "zod";

export const publicIdPrefixes = {
  user: "usr",
  sellerAccount: "sac",
  sellerMembership: "smb",
  role: "rol",
  grant: "grt",
  event: "evt",
  audit: "aud",
} as const;

export type PublicIdKind = keyof typeof publicIdPrefixes;
export type PublicId<K extends PublicIdKind = PublicIdKind> =
  `${(typeof publicIdPrefixes)[K]}_${string}`;

const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const uuidV7Schema = z.string().regex(uuidV7Pattern, "UUIDv7 inválido");

export function createUuidV7(now = Date.now()): string {
  if (!Number.isSafeInteger(now) || now < 0 || now > 0xffffffffffff) {
    throw new RangeError("Timestamp fora do intervalo UUIDv7");
  }

  const bytes = randomBytes(16);
  let timestamp = BigInt(now);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }

  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x70, 6);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createPublicId<K extends PublicIdKind>(kind: K): PublicId<K> {
  return `${publicIdPrefixes[kind]}_${createUuidV7()}` as PublicId<K>;
}

export function toPublicId<K extends PublicIdKind>(
  kind: K,
  uuid: string,
): PublicId<K> {
  uuidV7Schema.parse(uuid);
  return `${publicIdPrefixes[kind]}_${uuid}` as PublicId<K>;
}

export function parsePublicId(kind: PublicIdKind, value: string): string {
  const expectedPrefix = `${publicIdPrefixes[kind]}_`;
  if (!value.startsWith(expectedPrefix)) {
    throw new Error(`Identificador ${kind} inválido`);
  }

  return uuidV7Schema.parse(value.slice(expectedPrefix.length));
}

export function parseUuid(value: string): string {
  return uuidV7Schema.parse(value);
}
