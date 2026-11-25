export function formatPrintQuantity(quantity: number, unit?: string): string {
  const normalizedUnit = (unit ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const formattedQuantity = quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

  if (["mt", "metro", "metros", "m2"].includes(normalizedUnit)) return `${formattedQuantity} m²`;
  if (["kg", "quilo", "quilograma"].includes(normalizedUnit)) return `${formattedQuantity} kg`;
  if (["un", "unidade"].includes(normalizedUnit)) return `${formattedQuantity} un.`;
  return `${formattedQuantity} ${quantity === 1 ? "peça" : "peças"}`;
}
