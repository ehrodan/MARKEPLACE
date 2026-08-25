export function assertMinorBrl(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} deve ser um inteiro seguro não negativo em centavos de BRL.`);
  }
}

export function addMinorBrl(left: number, right: number, fieldName: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${fieldName} excede o intervalo seguro de centavos de BRL.`);
  }
  return result;
}

export function assertNonEmptyVersion(version: string): void {
  if (version.trim().length === 0) {
    throw new TypeError("A versão da política não pode ser vazia.");
  }
}

export function assertIsoInstant(value: string, fieldName: string): void {
  if (value.length === 0 || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${fieldName} deve ser um instante ISO válido.`);
  }
}

export function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}
