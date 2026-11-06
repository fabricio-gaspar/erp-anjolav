import { validarCNPJ, validarCPF } from "./validacoesFiscais.ts";

export type ClientPersonType = "cpf" | "cnpj";
export type ClientClassification = "residencial" | "industrial";

export interface ClientIdentityDraft {
  clientId?: string | null;
  personType: ClientPersonType;
  classification: ClientClassification;
  document: string;
  legalName: string;
  tradeName: string;
  email: string;
  phone: string;
  secondaryPhone: string;
  contact: string;
  stateRegistration: string;
  municipalRegistration: string;
  taxRegime: string;
  notes: string;
}

export interface ClientDuplicateCandidate {
  id: string;
  name: string;
  classification: ClientClassification;
  active: boolean;
  maskedDocument: string | null;
  maskedPhone: string | null;
  maskedEmail: string | null;
  matches: Array<"documento" | "telefone" | "email" | "nome">;
  documentConflict: boolean;
}

export type ClientIdentityField =
  | "document"
  | "legalName"
  | "email"
  | "phone"
  | "secondaryPhone"
  | "tradeName"
  | "contact"
  | "stateRegistration"
  | "municipalRegistration"
  | "notes";

export type ClientIdentityErrors = Partial<Record<ClientIdentityField, string>>;

export function normalizeClientDocument(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeClientPhone(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeClientEmail(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function normalizeClientName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function clientIdentityFingerprint(input: ClientIdentityDraft) {
  return JSON.stringify([
    input.clientId ?? null,
    input.classification,
    normalizeClientDocument(input.document),
    normalizeClientEmail(input.email),
    normalizeClientPhone(input.phone),
    normalizeClientPhone(input.secondaryPhone),
    normalizeClientName(input.legalName),
  ]);
}

export function hasClientDuplicateSignal(input: ClientIdentityDraft) {
  const document = normalizeClientDocument(input.document);
  return (
    document.length === 11 ||
    document.length === 14 ||
    normalizeClientEmail(input.email).length >= 5 ||
    normalizeClientPhone(input.phone).length >= 10 ||
    normalizeClientPhone(input.secondaryPhone).length >= 10 ||
    normalizeClientName(input.legalName).length >= 5
  );
}

function validatePhone(value: string, label: string) {
  const digits = normalizeClientPhone(value);
  if (!digits) return undefined;
  return digits.length >= 10 && digits.length <= 15
    ? undefined
    : `${label} deve conter entre 10 e 15 dígitos`;
}

export function validateClientIdentity(
  input: ClientIdentityDraft,
): ClientIdentityErrors {
  const errors: ClientIdentityErrors = {};
  const name = input.legalName.trim();
  const document = normalizeClientDocument(input.document);
  const email = normalizeClientEmail(input.email);

  if (name.length < 2 || name.length > 160) {
    errors.legalName = "Informe entre 2 e 160 caracteres";
  }
  if (document) {
    const valid =
      input.personType === "cpf" ? validarCPF(document) : validarCNPJ(document);
    if (!valid) errors.document = `${input.personType.toUpperCase()} inválido`;
  }
  if (
    email &&
    (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    errors.email = "Informe um e-mail válido";
  }
  const phoneError = validatePhone(input.phone, "Telefone principal");
  if (phoneError) errors.phone = phoneError;
  const secondaryPhoneError = validatePhone(
    input.secondaryPhone,
    "Telefone alternativo",
  );
  if (secondaryPhoneError) errors.secondaryPhone = secondaryPhoneError;

  const limits: Array<[ClientIdentityField, string, number, string]> = [
    ["tradeName", input.tradeName, 160, "Nome fantasia"],
    ["contact", input.contact, 160, "Contato"],
    ["stateRegistration", input.stateRegistration, 40, "Inscrição estadual"],
    [
      "municipalRegistration",
      input.municipalRegistration,
      40,
      "Inscrição municipal",
    ],
    ["notes", input.notes, 4_000, "Observações"],
  ];
  for (const [field, value, limit, label] of limits) {
    if (value.trim().length > limit)
      errors[field] = `${label} excede ${limit} caracteres`;
  }
  return errors;
}

export const CLIENT_DUPLICATE_REASON_LABELS = {
  documento: "mesmo CPF/CNPJ",
  telefone: "mesmo telefone",
  email: "mesmo e-mail",
  nome: "mesmo nome/razão social",
} as const;
