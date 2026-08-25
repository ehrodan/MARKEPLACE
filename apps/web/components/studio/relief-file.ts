export const RELIEF_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
export const RELIEF_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const RELIEF_MAX_DIMENSION = 4_096;
export const RELIEF_MAX_PIXELS = 12_000_000;

export type ReliefImageMime = "image/png" | "image/jpeg" | "image/webp";

export type ReliefFileErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "MIME_UNSUPPORTED"
  | "SIGNATURE_INVALID"
  | "MIME_MISMATCH"
  | "ANIMATED_UNSUPPORTED"
  | "DIMENSIONS_INVALID"
  | "DIMENSIONS_TOO_LARGE"
  | "PIXELS_TOO_LARGE"
  | "DECODE_FAILED";

export class ReliefFileError extends Error {
  constructor(
    public readonly code: ReliefFileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReliefFileError";
  }
}

export type ReliefImageDetails = {
  readonly mimeType: ReliefImageMime;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly animated: false;
};

export type DecodedReliefImage = {
  readonly width: number;
  readonly height: number;
  close?: () => void;
};

export type ReliefImageDecoder = (file: File) => Promise<DecodedReliefImage>;

type DetectedImage = {
  mimeType: ReliefImageMime;
  width: number;
  height: number;
  animated: boolean;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function hasBytes(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function hasAscii(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset < 0 || offset + value.length > bytes.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function invalidSignature(): never {
  throw new ReliefFileError(
    "SIGNATURE_INVALID",
    "O conteúdo não corresponde a um PNG, JPEG ou WebP íntegro.",
  );
}

function detectPng(bytes: Uint8Array): DetectedImage {
  if (bytes.length < 33 || !hasAscii(bytes, 12, "IHDR")) invalidSignature();
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  let animated = false;
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const chunkLength = readUint32BE(bytes, offset);
    const chunkEnd = offset + 12 + chunkLength;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.length) invalidSignature();
    if (hasAscii(bytes, offset + 4, "acTL")) animated = true;
    offset = chunkEnd;
  }

  return { mimeType: "image/png", width, height, animated };
}

function detectJpeg(bytes: Uint8Array): DetectedImage {
  let offset = 2;

  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 1 >= bytes.length) invalidSignature();

    const segmentLength = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) invalidSignature();

    if (JPEG_START_OF_FRAME.has(marker)) {
      if (segmentLength < 7) invalidSignature();
      const height = ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0);
      const width = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      return { mimeType: "image/jpeg", width, height, animated: false };
    }
    offset += segmentLength;
  }

  return invalidSignature();
}

function webpChunkDimensions(
  bytes: Uint8Array,
  type: string,
  dataOffset: number,
  chunkLength: number,
): { width: number; height: number; animated: boolean } | null {
  if (type === "VP8X") {
    if (chunkLength < 10) invalidSignature();
    return {
      width: readUint24LE(bytes, dataOffset + 4) + 1,
      height: readUint24LE(bytes, dataOffset + 7) + 1,
      animated: Boolean((bytes[dataOffset] ?? 0) & 0x02),
    };
  }

  if (type === "VP8 ") {
    if (chunkLength < 10 || !hasBytes(bytes, dataOffset + 3, [0x9d, 0x01, 0x2a])) invalidSignature();
    return {
      width: (((bytes[dataOffset + 7] ?? 0) << 8) | (bytes[dataOffset + 6] ?? 0)) & 0x3fff,
      height: (((bytes[dataOffset + 9] ?? 0) << 8) | (bytes[dataOffset + 8] ?? 0)) & 0x3fff,
      animated: false,
    };
  }

  if (type === "VP8L") {
    if (chunkLength < 5 || bytes[dataOffset] !== 0x2f) invalidSignature();
    const first = bytes[dataOffset + 1] ?? 0;
    const second = bytes[dataOffset + 2] ?? 0;
    const third = bytes[dataOffset + 3] ?? 0;
    const fourth = bytes[dataOffset + 4] ?? 0;
    return {
      width: 1 + first + ((second & 0x3f) << 8),
      height: 1 + (second >> 6) + (third << 2) + ((fourth & 0x0f) << 10),
      animated: false,
    };
  }

  return null;
}

function detectWebp(bytes: Uint8Array): DetectedImage {
  if (bytes.length < 20 || !hasAscii(bytes, 0, "RIFF") || !hasAscii(bytes, 8, "WEBP")) {
    invalidSignature();
  }

  let offset = 12;
  let dimensions: { width: number; height: number; animated: boolean } | null = null;
  let animationChunk = false;

  while (offset + 8 <= bytes.length) {
    const chunkLength = readUint32LE(bytes, offset + 4);
    const dataOffset = offset + 8;
    const chunkEnd = dataOffset + chunkLength;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.length) invalidSignature();
    const type = String.fromCharCode(
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0,
    );
    if (type === "ANIM" || type === "ANMF") animationChunk = true;
    dimensions ??= webpChunkDimensions(bytes, type, dataOffset, chunkLength);
    offset = chunkEnd + (chunkLength % 2);
  }

  if (!dimensions) invalidSignature();
  return {
    mimeType: "image/webp",
    width: dimensions.width,
    height: dimensions.height,
    animated: dimensions.animated || animationChunk,
  };
}

export function detectReliefImage(bytes: Uint8Array): DetectedImage {
  if (hasBytes(bytes, 0, PNG_SIGNATURE)) return detectPng(bytes);
  if (hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) return detectJpeg(bytes);
  if (hasAscii(bytes, 0, "RIFF") && hasAscii(bytes, 8, "WEBP")) return detectWebp(bytes);
  return invalidSignature();
}

function validateDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new ReliefFileError("DIMENSIONS_INVALID", "A imagem não informou dimensões válidas.");
  }
  if (width > RELIEF_MAX_DIMENSION || height > RELIEF_MAX_DIMENSION) {
    throw new ReliefFileError(
      "DIMENSIONS_TOO_LARGE",
      `Use uma imagem de até ${String(RELIEF_MAX_DIMENSION)} px por lado.`,
    );
  }
  if (width * height > RELIEF_MAX_PIXELS) {
    throw new ReliefFileError(
      "PIXELS_TOO_LARGE",
      "A imagem ultrapassa o limite de 12 milhões de pixels deste preview local.",
    );
  }
}

async function decodeInBrowser(file: File): Promise<DecodedReliefImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      close: () => { bitmap.close(); },
    };
  }

  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("Decoder de imagem indisponível.");
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = sourceUrl;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return await file.arrayBuffer();
  if (typeof FileReader === "undefined") throw new Error("Leitor de arquivo indisponível.");

  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => { reject(reader.error ?? new Error("Falha ao ler o arquivo.")); };
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("O arquivo não produziu bytes binários."));
    };
    reader.readAsArrayBuffer(file);
  });
}

export async function validateReliefFile(
  file: File,
  decoder: ReliefImageDecoder = decodeInBrowser,
): Promise<ReliefImageDetails> {
  if (file.size < 1) {
    throw new ReliefFileError("EMPTY_FILE", "Escolha uma imagem que contenha dados.");
  }
  if (file.size > RELIEF_MAX_FILE_BYTES) {
    throw new ReliefFileError("FILE_TOO_LARGE", "A imagem deve ter no máximo 8 MB.");
  }

  const declaredMime = file.type.trim().toLocaleLowerCase("en-US");
  if (declaredMime !== "image/png" && declaredMime !== "image/jpeg" && declaredMime !== "image/webp") {
    throw new ReliefFileError("MIME_UNSUPPORTED", "Use uma imagem PNG, JPEG ou WebP estática.");
  }

  let rawBytes: ArrayBuffer;
  try {
    rawBytes = await readFileBytes(file);
  } catch {
    throw new ReliefFileError("DECODE_FAILED", "O navegador não conseguiu ler esta imagem.");
  }
  const bytes = new Uint8Array(rawBytes);
  const detected = detectReliefImage(bytes);
  if (declaredMime !== detected.mimeType) {
    throw new ReliefFileError(
      "MIME_MISMATCH",
      "O tipo declarado do arquivo não corresponde ao conteúdo real da imagem.",
    );
  }
  if (detected.animated) {
    throw new ReliefFileError(
      "ANIMATED_UNSUPPORTED",
      "Imagens animadas não entram no relevo. Exporte um único quadro estático.",
    );
  }
  validateDimensions(detected.width, detected.height);

  let decoded: DecodedReliefImage;
  try {
    decoded = await decoder(file);
    if (!decoded || typeof decoded.width !== "number" || typeof decoded.height !== "number") {
      throw new Error("Decoder retornou dimensões inválidas.");
    }
  } catch {
    throw new ReliefFileError("DECODE_FAILED", "O navegador não conseguiu decodificar esta imagem.");
  }

  try {
    validateDimensions(decoded.width, decoded.height);
    return Object.freeze({
      mimeType: detected.mimeType,
      width: decoded.width,
      height: decoded.height,
      bytes: file.size,
      animated: false,
    });
  } finally {
    decoded.close?.();
  }
}
