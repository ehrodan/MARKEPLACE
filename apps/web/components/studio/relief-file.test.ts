import { describe, expect, it, vi } from "vitest";
import {
  RELIEF_MAX_FILE_BYTES,
  detectReliefImage,
  validateReliefFile,
  type ReliefFileError,
  type ReliefImageDecoder,
} from "./relief-file";

function writeUint32BE(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer).setUint32(offset, value, false);
}

function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer).setUint32(offset, value, true);
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function pngBytes(width: number, height: number, animated = false): Uint8Array {
  const bytes = new Uint8Array(animated ? 53 : 33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  writeUint32BE(bytes, 8, 13);
  writeAscii(bytes, 12, "IHDR");
  writeUint32BE(bytes, 16, width);
  writeUint32BE(bytes, 20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  if (animated) {
    writeUint32BE(bytes, 33, 8);
    writeAscii(bytes, 37, "acTL");
  }
  return bytes;
}

function jpegBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  bytes[7] = (height >> 8) & 0xff;
  bytes[8] = height & 0xff;
  bytes[9] = (width >> 8) & 0xff;
  bytes[10] = width & 0xff;
  return bytes;
}

function webpBytes(width: number, height: number, animated = false): Uint8Array {
  const bytes = new Uint8Array(30);
  writeAscii(bytes, 0, "RIFF");
  writeUint32LE(bytes, 4, 22);
  writeAscii(bytes, 8, "WEBP");
  writeAscii(bytes, 12, "VP8X");
  writeUint32LE(bytes, 16, 10);
  bytes[20] = animated ? 0x02 : 0;
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  bytes[24] = widthMinusOne & 0xff;
  bytes[25] = (widthMinusOne >> 8) & 0xff;
  bytes[26] = (widthMinusOne >> 16) & 0xff;
  bytes[27] = heightMinusOne & 0xff;
  bytes[28] = (heightMinusOne >> 8) & 0xff;
  bytes[29] = (heightMinusOne >> 16) & 0xff;
  return bytes;
}

function imageFile(bytes: Uint8Array, type: string, name = "skin"): File {
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  return new File([owned.buffer], name, { type });
}

function decoder(width: number, height: number, close = vi.fn()): ReliefImageDecoder {
  return () => Promise.resolve({ width, height, close });
}

async function expectCode(promise: Promise<unknown>, code: ReliefFileError["code"]): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("detectReliefImage", () => {
  it.each([
    [pngBytes(800, 600), "image/png", 800, 600],
    [jpegBytes(1_280, 720), "image/jpeg", 1_280, 720],
    [webpBytes(1_024, 1_024), "image/webp", 1_024, 1_024],
  ] as const)("lê assinatura e dimensões de %s", (bytes, mimeType, width, height) => {
    expect(detectReliefImage(bytes)).toMatchObject({ mimeType, width, height, animated: false });
  });

  it("rejeita conteúdo que apenas finge ser imagem", () => {
    expect(() => detectReliefImage(new TextEncoder().encode("not-an-image"))).toThrow(
      expect.objectContaining({ code: "SIGNATURE_INVALID" }),
    );
  });
});

describe("validateReliefFile", () => {
  it("aceita PNG estático, valida decode e fecha o bitmap", async () => {
    const close = vi.fn();
    const result = await validateReliefFile(
      imageFile(pngBytes(1_200, 800), "image/png", "faca.png"),
      decoder(1_200, 800, close),
    );

    expect(result).toMatchObject({
      mimeType: "image/png",
      width: 1_200,
      height: 800,
      animated: false,
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("exige que MIME declarado e assinatura sejam compatíveis", async () => {
    await expectCode(
      validateReliefFile(imageFile(pngBytes(320, 320), "image/jpeg"), decoder(320, 320)),
      "MIME_MISMATCH",
    );
    await expectCode(
      validateReliefFile(imageFile(new Uint8Array([1, 2, 3]), "image/png"), decoder(1, 1)),
      "SIGNATURE_INVALID",
    );
  });

  it("rejeita MIME não permitido e arquivo vazio", async () => {
    await expectCode(
      validateReliefFile(imageFile(new Uint8Array([0x47, 0x49, 0x46]), "image/gif"), decoder(1, 1)),
      "MIME_UNSUPPORTED",
    );
    await expectCode(validateReliefFile(imageFile(new Uint8Array(), "image/png")), "EMPTY_FILE");
  });

  it("rejeita arquivo acima do orçamento antes de ler ou decodificar", async () => {
    const oversized = new File(
      [new Uint8Array(RELIEF_MAX_FILE_BYTES + 1)],
      "grande.png",
      { type: "image/png" },
    );
    const decode = vi.fn<ReliefImageDecoder>();
    await expectCode(validateReliefFile(oversized, decode), "FILE_TOO_LARGE");
    expect(decode).not.toHaveBeenCalled();
  });

  it("bloqueia dimensão e total de pixels antes do decode", async () => {
    const decode = vi.fn<ReliefImageDecoder>();
    await expectCode(
      validateReliefFile(imageFile(pngBytes(4_097, 100), "image/png"), decode),
      "DIMENSIONS_TOO_LARGE",
    );
    await expectCode(
      validateReliefFile(imageFile(pngBytes(4_096, 4_096), "image/png"), decode),
      "PIXELS_TOO_LARGE",
    );
    expect(decode).not.toHaveBeenCalled();
  });

  it.each([
    [pngBytes(600, 600, true), "image/png"],
    [webpBytes(600, 600, true), "image/webp"],
  ] as const)("bloqueia imagem animada %s", async (bytes, type) => {
    await expectCode(
      validateReliefFile(imageFile(bytes, type), decoder(600, 600)),
      "ANIMATED_UNSUPPORTED",
    );
  });

  it("transforma falha do decoder em erro seguro", async () => {
    await expectCode(
      validateReliefFile(
        imageFile(jpegBytes(640, 480), "image/jpeg"),
        () => Promise.reject(new Error("decoder internals")),
      ),
      "DECODE_FAILED",
    );
  });

  it("fecha o bitmap mesmo quando o decode revela dimensão acima do limite", async () => {
    const close = vi.fn();
    await expectCode(
      validateReliefFile(
        imageFile(webpBytes(800, 800), "image/webp"),
        decoder(5_000, 800, close),
      ),
      "DIMENSIONS_TOO_LARGE",
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
