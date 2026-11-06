import { CheckCircle, Droplets, Package, Scissors, Truck, Wind } from "lucide-react";

export const PRODUCTION_STAGE_SEQUENCE = [
  "retirada",
  "separacao",
  "lavagem",
  "secagem",
  "passadoria",
  "embalagem",
  "expedicao",
] as const;

export type ProductionStage = (typeof PRODUCTION_STAGE_SEQUENCE)[number];

export const productionStageLabels: Record<ProductionStage, string> = {
  retirada: "Aguardando retirada",
  separacao: "Separação",
  lavagem: "Lavagem",
  secagem: "Secagem",
  passadoria: "Acabamento",
  embalagem: "Embalagem",
  expedicao: "Pronto para expedição",
};

export const productionColumns = [
  { id: "retirada", title: "AGUARDANDO RETIRADA", icon: Truck, iconColor: "text-warning", statuses: ["retirada"] },
  { id: "separacao", title: "SEPARAÇÃO", icon: Scissors, iconColor: "text-info", statuses: ["separacao"] },
  { id: "lavagem", title: "LAVAGEM + SECAGEM", icon: Droplets, iconColor: "text-primary", statuses: ["lavagem", "secagem"] },
  { id: "passadoria", title: "ACABAMENTO", icon: Wind, iconColor: "text-purple-500", statuses: ["passadoria"] },
  { id: "embalagem", title: "EMBALAGEM", icon: Package, iconColor: "text-success", statuses: ["embalagem"] },
  { id: "expedicao", title: "PRONTO / SAIU", icon: CheckCircle, iconColor: "text-emerald-600", statuses: ["expedicao"] },
] as const;

export function getNextProductionStage(stage: string): ProductionStage | null {
  const index = PRODUCTION_STAGE_SEQUENCE.indexOf(stage as ProductionStage);
  if (index < 0 || index >= PRODUCTION_STAGE_SEQUENCE.length - 1) return null;
  return PRODUCTION_STAGE_SEQUENCE[index + 1];
}

export function canBatchProductionStage(stage: string): stage is "lavagem" | "secagem" | "passadoria" {
  return stage === "lavagem" || stage === "secagem" || stage === "passadoria";
}

export function requiresProductionResource(stage: string) {
  return stage === "lavagem" || stage === "secagem";
}
