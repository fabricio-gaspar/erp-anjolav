export type FiscalOperation = "domestico" | "industrial";
export type NfseStatus =
  | "nao_preparada"
  | "validada"
  | "aguardando_configuracao"
  | "processando"
  | "autorizada"
  | "rejeitada"
  | "erro_temporario"
  | "cancelada";

export interface FiscalEmitterSummary {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  operation_type: FiscalOperation | null;
  ambiente: "homologacao" | "producao";
  modo_emissao: "simulacao" | "homologacao" | "producao" | null;
  credencial_status: "nao_configurada" | "configurada" | "homologada" | "expirada" | "erro";
}

export interface FiscalEmitterSelection<T extends FiscalEmitterSummary> {
  emitter: T | null;
  source: "cliente" | "operacao" | "unico" | "nenhum";
  issue: string | null;
}

export function selectFiscalEmitter<T extends FiscalEmitterSummary>(
  emitters: T[],
  preferredId: string | null | undefined,
  operation: FiscalOperation | null | undefined,
): FiscalEmitterSelection<T> {
  const active = emitters.filter((emitter) => emitter.ativo);
  if (preferredId) {
    const preferred = active.find((emitter) => emitter.id === preferredId);
    if (preferred) return { emitter: preferred, source: "cliente", issue: null };
    return {
      emitter: null,
      source: "nenhum",
      issue: "O CNPJ emissor definido no cliente está inativo ou indisponível.",
    };
  }

  if (operation) {
    const defaults = active.filter((emitter) => emitter.operation_type === operation);
    if (defaults.length === 1) return { emitter: defaults[0], source: "operacao", issue: null };
    if (defaults.length > 1) {
      return { emitter: null, source: "nenhum", issue: "Há mais de um CNPJ padrão para esta operação." };
    }
  }

  if (active.length === 1) return { emitter: active[0], source: "unico", issue: null };
  if (active.length > 1) {
    return {
      emitter: null,
      source: "nenhum",
      issue: "Selecione qual CNPJ emitirá esta nota. O sistema não escolherá entre dois emitentes automaticamente.",
    };
  }
  return { emitter: null, source: "nenhum", issue: "Nenhum CNPJ emissor ativo foi cadastrado." };
}

export function formatCnpj(value: string | null | undefined): string {
  const digits = (value || "").replace(/\D/g, "").slice(0, 14);
  if (digits.length !== 14) return value || "Não informado";
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export const NFSE_STATUS_LABELS: Record<NfseStatus, string> = {
  nao_preparada: "Não preparada",
  validada: "Dados validados",
  aguardando_configuracao: "Aguardando configuração",
  processando: "Em processamento",
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  erro_temporario: "Falha temporária",
  cancelada: "Cancelada",
};

export function nfseStatusLabel(status: string | null | undefined): string {
  return NFSE_STATUS_LABELS[status as NfseStatus] || "Não preparada";
}
