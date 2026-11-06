import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createIdempotencyKey } from "@/lib/idempotency";

export interface BeneficioCatalogo {
  id: string;
  tenant_id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  versao: number;
  created_at: string;
  updated_at: string;
}

export interface BeneficioCatalogoInput {
  id?: string;
  versao?: number;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
}

export const CORES_BENEFICIO: {
  value: string;
  label: string;
  className: string;
  dot: string;
}[] = [
  { value: "blue", label: "Azul", className: "bg-blue-100 text-blue-800 border-blue-300/60 dark:bg-blue-900/40 dark:text-blue-200", dot: "bg-blue-500" },
  { value: "green", label: "Verde", className: "bg-green-100 text-green-800 border-green-300/60 dark:bg-green-900/40 dark:text-green-200", dot: "bg-green-500" },
  { value: "orange", label: "Laranja", className: "bg-orange-100 text-orange-800 border-orange-300/60 dark:bg-orange-900/40 dark:text-orange-200", dot: "bg-orange-500" },
  { value: "rose", label: "Rosa", className: "bg-rose-100 text-rose-800 border-rose-300/60 dark:bg-rose-900/40 dark:text-rose-200", dot: "bg-rose-500" },
  { value: "cyan", label: "Ciano", className: "bg-cyan-100 text-cyan-800 border-cyan-300/60 dark:bg-cyan-900/40 dark:text-cyan-200", dot: "bg-cyan-500" },
  { value: "amber", label: "Âmbar", className: "bg-amber-100 text-amber-800 border-amber-300/60 dark:bg-amber-900/40 dark:text-amber-200", dot: "bg-amber-500" },
  { value: "purple", label: "Roxo", className: "bg-purple-100 text-purple-800 border-purple-300/60 dark:bg-purple-900/40 dark:text-purple-200", dot: "bg-purple-500" },
  { value: "slate", label: "Cinza", className: "bg-slate-100 text-slate-800 border-slate-300/60 dark:bg-slate-800/60 dark:text-slate-200", dot: "bg-slate-500" },
];

export const corClasses = (color?: string) =>
  CORES_BENEFICIO.find((item) => item.value === color)?.className || CORES_BENEFICIO[7].className;
export const corDot = (color?: string) =>
  CORES_BENEFICIO.find((item) => item.value === color)?.dot || CORES_BENEFICIO[7].dot;

function useRetainedIdempotencyKey(prefix: string) {
  const keys = useRef(new Map<string, string>());
  return {
    get(fingerprint: string) {
      const retained = keys.current.get(fingerprint);
      if (retained) return retained;
      const created = createIdempotencyKey(prefix);
      keys.current.set(fingerprint, created);
      return created;
    },
    release(fingerprint: string) {
      keys.current.delete(fingerprint);
    },
  };
}

export function useBeneficiosCatalogo() {
  const { activeTenant, user } = useAuth();
  return useQuery({
    queryKey: ["beneficios_catalogo", activeTenant?.id, user?.id],
    queryFn: async () => {
      if (!activeTenant) return [];
      const { data, error } = await supabase
        .from("beneficios_catalogo")
        .select("*")
        .eq("tenant_id", activeTenant.id)
        .order("ativo", { ascending: false })
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BeneficioCatalogo[];
    },
    enabled: Boolean(activeTenant && user),
    staleTime: 15_000,
  });
}

export function useUpsertBeneficioCatalogo() {
  const queryClient = useQueryClient();
  const idempotency = useRetainedIdempotencyKey("payroll-catalog");
  return useMutation({
    mutationFn: async (benefit: BeneficioCatalogoInput) => {
      const fingerprint = JSON.stringify([
        benefit.id ?? null,
        benefit.versao ?? null,
        benefit.nome.trim(),
        benefit.cor,
        benefit.ordem,
        benefit.ativo,
      ]);
      const { data, error } = await supabase.rpc("salvar_beneficio_catalogo", {
        _beneficio_id: benefit.id,
        _versao_observada: benefit.versao,
        _nome: benefit.nome.trim(),
        _cor: benefit.cor,
        _ordem: benefit.ordem,
        _ativo: benefit.ativo,
        _idempotency_key: idempotency.get(fingerprint),
      });
      if (error) throw error;
      if (!data || typeof data !== "object") {
        throw new Error("O servidor não retornou o benefício atualizado.");
      }
      return data as unknown as BeneficioCatalogo;
    },
    onSuccess: async (_result, benefit) => {
      idempotency.release(JSON.stringify([
        benefit.id ?? null,
        benefit.versao ?? null,
        benefit.nome.trim(),
        benefit.cor,
        benefit.ordem,
        benefit.ativo,
      ]));
      await queryClient.invalidateQueries({ queryKey: ["beneficios_catalogo"] });
      toast.success(benefit.ativo ? "Benefício salvo" : "Benefício arquivado");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
