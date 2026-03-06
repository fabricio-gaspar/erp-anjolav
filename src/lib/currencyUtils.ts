/**
 * Formata um valor string enquanto o usuário digita, aplicando máscara monetária BR.
 * Ex: "1518" → "1.518", "151800" → "1.518,00"
 * Aceita apenas dígitos, ponto e vírgula.
 */
export function formatCurrencyInput(raw: string): string {
  // Remove tudo que não é dígito ou vírgula
  let cleaned = raw.replace(/[^\d,]/g, "");

  // Separa parte inteira e decimal pela vírgula
  const parts = cleaned.split(",");
  let inteiro = parts[0] || "";
  const decimal = parts.length > 1 ? parts[1].slice(0, 2) : undefined;

  // Remove zeros à esquerda (mas mantém pelo menos um dígito)
  inteiro = inteiro.replace(/^0+(?=\d)/, "");

  // Adiciona separadores de milhar
  inteiro = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (decimal !== undefined) {
    return `${inteiro},${decimal}`;
  }
  return inteiro;
}

/**
 * Converte valor formatado BR para número.
 * Ex: "1.518,00" → 1518.00, "350,50" → 350.50
 */
export function parseCurrencyToNumber(value: string): number {
  if (!value) return 0;
  // Remove pontos (milhar), troca vírgula por ponto (decimal)
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Formata número para display BR.
 * Ex: 1518 → "1.518,00", 350.5 → "350,50"
 */
export function formatNumberToCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
