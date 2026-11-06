export const CLIENT_ADDRESS_TYPES = [
  "principal",
  "coleta",
  "entrega",
  "faturamento",
  "outro",
] as const;

export type ClientAddressType = (typeof CLIENT_ADDRESS_TYPES)[number];

export const CLIENT_ADDRESS_TYPE_LABELS: Record<ClientAddressType, string> = {
  principal: "Principal",
  coleta: "Coleta",
  entrega: "Entrega",
  faturamento: "Faturamento",
  outro: "Outro",
};

export interface ClientAddressDraft {
  id?: string | null;
  clientId: string;
  type: ClientAddressType;
  name: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  primary: boolean;
  instructions: string;
}

export interface ClientAddressValidation {
  valid: boolean;
  fieldErrors: Partial<Record<"postalCode" | "street" | "city" | "state" | "coordinates", string>>;
}

const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, " ");

export function normalizeClientAddressDraft(draft: ClientAddressDraft): ClientAddressDraft {
  const postalCode = draft.postalCode.replace(/\D/g, "").slice(0, 8);
  const state = draft.state.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2);
  return {
    ...draft,
    name: collapseSpaces(draft.name).slice(0, 80),
    postalCode,
    street: collapseSpaces(draft.street).slice(0, 200),
    number: collapseSpaces(draft.number).slice(0, 30),
    complement: collapseSpaces(draft.complement).slice(0, 120),
    neighborhood: collapseSpaces(draft.neighborhood).slice(0, 120),
    city: collapseSpaces(draft.city).slice(0, 120),
    state,
    country: collapseSpaces(draft.country).slice(0, 80) || "Brasil",
    instructions: collapseSpaces(draft.instructions).slice(0, 500),
  };
}

export function validateClientAddressDraft(draft: ClientAddressDraft): ClientAddressValidation {
  const normalized = normalizeClientAddressDraft(draft);
  const fieldErrors: ClientAddressValidation["fieldErrors"] = {};
  if (normalized.postalCode && normalized.postalCode.length !== 8) {
    fieldErrors.postalCode = "Informe os 8 dígitos do CEP.";
  }
  if (!normalized.street) fieldErrors.street = "Informe o logradouro.";
  if (!normalized.city) fieldErrors.city = "Informe a cidade.";
  if (normalized.state.length !== 2) fieldErrors.state = "Informe uma UF válida.";
  const hasLatitude = normalized.latitude !== null;
  const hasLongitude = normalized.longitude !== null;
  if (hasLatitude !== hasLongitude) {
    fieldErrors.coordinates = "Latitude e longitude devem ser informadas juntas.";
  } else if (
    hasLatitude && hasLongitude
    && (normalized.latitude! < -90 || normalized.latitude! > 90
      || normalized.longitude! < -180 || normalized.longitude! > 180)
  ) {
    fieldErrors.coordinates = "As coordenadas estão fora da faixa válida.";
  }
  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function formatClientAddress(address: {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}) {
  const firstLine = [address.logradouro, address.numero].filter(Boolean).join(", ");
  const location = [address.bairro, [address.cidade, address.uf].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(" • ");
  return [firstLine, address.complemento, location].filter(Boolean).join(" — ") || "Endereço incompleto";
}
