import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PdvArea } from "@/lib/authorization";
import type { DeliveryPricingModel } from "@/lib/deliveryPricing";

export interface PdvCommercialRules {
  area: PdvArea;
  urgencyPercentage: number;
  defaultDeliveryFee: number;
  deliveryPricingModel: DeliveryPricingModel;
  deliveryBaseFee: number;
  deliveryFeePerKm: number;
  updatedAt?: string | null;
}

const normalize = (value: unknown): PdvCommercialRules => {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    area: row.area === "industrial" ? "industrial" : "residencial",
    urgencyPercentage: Math.min(100, Math.max(0, Number(row.urgencyPercentage ?? row.percentual_urgencia ?? 30) || 0)),
    defaultDeliveryFee: Math.max(0, Number(row.defaultDeliveryFee ?? row.taxa_entrega_padrao ?? 0) || 0),
    deliveryPricingModel: row.deliveryPricingModel === "km" ? "km" : "fixo",
    deliveryBaseFee: Math.max(0, Number(row.deliveryBaseFee ?? row.taxa_entrega_padrao ?? 0) || 0),
    deliveryFeePerKm: Math.max(0, Number(row.deliveryFeePerKm ?? row.taxa_entrega_por_km ?? 0) || 0),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
  };
};

export function usePdvCommercialRules(area: PdvArea, enabled = true) {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["pdv-commercial-rules", activeTenant?.id, session?.user.id, area],
    enabled: enabled && Boolean(activeTenant?.id && session?.user.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consultar_regras_comerciais_pdv", { _area: area });
      if (error) throw error;
      return normalize(data);
    },
    staleTime: 60_000,
  });
}

export function useSavePdvCommercialRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { area: PdvArea; urgencyPercentage: number; deliveryPricingModel: DeliveryPricingModel; deliveryBaseFee: number; deliveryFeePerKm: number }) => {
      const { data, error } = await supabase.rpc("salvar_regras_comerciais_pdv_v2", {
        _area: input.area,
        _percentual_urgencia: input.urgencyPercentage,
        _modelo_delivery: input.deliveryPricingModel,
        _taxa_base_delivery: input.deliveryBaseFee,
        _taxa_por_km: input.deliveryFeePerKm,
      });
      if (error) throw error;
      return normalize(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-commercial-rules"] });
    },
  });
}
