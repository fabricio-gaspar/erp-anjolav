import type { PdvManualPayment } from "@/lib/pdvPayment";

export interface PdvSaleItemInput {
  produto_id: string;
  quantidade: number;
  cor_item?: string;
  marca_item?: string;
  avarias?: string;
  posicao_prateleira?: string;
  observacoes?: string;
}

export interface PdvSaleRequest {
  clientId: string;
  cashRegisterId: string | null;
  deliveryDate: string;
  urgent: boolean;
  urgencyPercentage: number;
  discountAmount: number;
  driverId?: string;
  vehicleId?: string;
  items: PdvSaleItemInput[];
  payment: PdvManualPayment | { method: "PIX"; amount?: number } | null;
  idempotencyKey: string;
  intakeDate?: string | null;
  notes?: string | null;
  receiptMode?: "balcao" | "coleta";
  deliveryMode?: "balcao" | "entrega";
  deliveryFee?: number;
  addressSnapshot?: {
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    pais?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  capacityOverride?: boolean;
}
