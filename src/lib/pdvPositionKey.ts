/** Match the catalog's case, accent and whitespace insensitive name check. */
export function pdvPositionKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
}
