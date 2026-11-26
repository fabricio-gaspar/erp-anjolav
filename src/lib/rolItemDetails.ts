export function formatRolItemDetails(item: {
  cor_item?: string | null;
  marca_item?: string | null;
  avarias?: string | null;
  observacoes?: string | null;
}): string | null {
  return [
    item.cor_item?.trim() && `Cor: ${item.cor_item.trim()}`,
    item.marca_item?.trim() && `Marca: ${item.marca_item.trim()}`,
    item.avarias?.trim() && `Avarias: ${item.avarias.trim()}`,
    item.observacoes?.trim(),
  ].filter(Boolean).join("\n") || null;
}
