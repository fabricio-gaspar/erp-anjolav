function hasRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function digitFor(value: string, factors: number[]): number {
  const sum = factors.reduce(
    (total, factor, index) => total + Number(value[index]) * factor,
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || hasRepeatedDigits(value)) return false;
  const first = digitFor(value, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digitFor(value, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return value.endsWith(`${first}${second}`);
}

export function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || hasRepeatedDigits(value)) return false;
  const first = digitFor(value, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digitFor(value, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return value.endsWith(`${first}${second}`);
}

export function isValidCpfCnpj(value: string): boolean {
  return value.length === 11 ? isValidCpf(value) : isValidCnpj(value);
}
