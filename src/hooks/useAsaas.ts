import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateChargeParams {
  customer_name: string;
  customer_email?: string;
  customer_cpf_cnpj: string;
  description: string;
  value: number;
  due_date: string;
  billing_type: "BOLETO" | "PIX" | "BOLETO_PIX";
}

interface AsaasCharge {
  id: string;
  asaas_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_cpf_cnpj: string | null;
  description: string;
  value: number;
  due_date: string;
  billing_type: string;
  status: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

export function useAsaasCharges() {
  return useQuery({
    queryKey: ["asaas-charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asaas_charges")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AsaasCharge[];
    },
  });
}

export function useCreateAsaasCharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateChargeParams) => {
      const { data, error } = await supabase.functions.invoke("create-asaas-charge", {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asaas-charges"] });
      toast.success("Cobrança criada com sucesso!");
    },
    onError: (error: Error) => {
      console.error("Error creating charge:", error);
      toast.error(`Erro ao criar cobrança: ${error.message}`);
    },
  });
}

export function useDeleteAsaasCharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chargeId: string) => {
      const { error } = await supabase
        .from("asaas_charges")
        .delete()
        .eq("id", chargeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asaas-charges"] });
      toast.success("Cobrança excluída com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir cobrança: ${error.message}`);
    },
  });
}

export function useUpdateChargeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chargeId, status, paidAt }: { chargeId: string; status: string; paidAt?: string }) => {
      const updateData: { status: string; paid_at?: string } = { status };
      if (paidAt) {
        updateData.paid_at = paidAt;
      }

      const { error } = await supabase
        .from("asaas_charges")
        .update(updateData)
        .eq("id", chargeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asaas-charges"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });
}
