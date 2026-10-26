export type PortalLoyaltyEntryType = "CREDITO" | "RESGATE" | "ESTORNO" | "EXPIRACAO";

export interface PortalLoyaltyConfig {
  ativo: boolean;
  portal_exibir_fidelidade: boolean;
  valor_por_ponto: number | string;
  pontos_minimos_resgate: number | string;
}

export interface PortalLoyaltyBalanceEntry {
  pontos: number | string | null;
}

export interface PortalLoyaltyHistoryEntry {
  descricao: string;
  pontos: number | string | null;
  tipo: string;
  created_at: string;
}

export interface PortalLoyaltyEntry {
  description: string;
  points: number;
  type: PortalLoyaltyEntryType;
  timestamp: string;
}

export interface PortalLoyalty {
  active: boolean;
  visible: boolean;
  balancePoints: number;
  balanceValue: number;
  minimumRedemptionPoints: number;
  recentEntries: PortalLoyaltyEntry[];
}

const PORTAL_LOYALTY_TYPES = new Set<PortalLoyaltyEntryType>([
  "CREDITO",
  "RESGATE",
  "ESTORNO",
  "EXPIRACAO",
]);

function toFiniteNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function isPortalLoyaltyEntryType(value: string): value is PortalLoyaltyEntryType {
  return PORTAL_LOYALTY_TYPES.has(value as PortalLoyaltyEntryType);
}

function inertPortalLoyalty(): PortalLoyalty {
  return {
    active: false,
    visible: false,
    balancePoints: 0,
    balanceValue: 0,
    minimumRedemptionPoints: 0,
    recentEntries: [],
  };
}

export function isPortalLoyaltyVisible(config: PortalLoyaltyConfig | null): boolean {
  return config?.ativo === true && config.portal_exibir_fidelidade === true;
}

export function buildPortalLoyalty(
  config: PortalLoyaltyConfig | null,
  balanceEntries: readonly PortalLoyaltyBalanceEntry[],
  recentEntries: readonly PortalLoyaltyHistoryEntry[],
): PortalLoyalty {
  if (!isPortalLoyaltyVisible(config)) return inertPortalLoyalty();

  const balancePoints = Math.max(
    balanceEntries.reduce((total, entry) => total + toFiniteNumber(entry.pontos), 0),
    0,
  );
  const balanceValue = Math.round((balancePoints * toFiniteNumber(config.valor_por_ponto) + Number.EPSILON) * 100) / 100;

  return {
    active: true,
    visible: true,
    balancePoints,
    balanceValue,
    minimumRedemptionPoints: toFiniteNumber(config.pontos_minimos_resgate),
    recentEntries: recentEntries.slice(0, 10).flatMap((entry) => {
      const points = toFiniteNumber(entry.pontos);
      if (!isPortalLoyaltyEntryType(entry.tipo) || !Number.isFinite(points)) return [];

      return [{
        description: entry.descricao,
        points,
        type: entry.tipo,
        timestamp: entry.created_at,
      }];
    }),
  };
}
