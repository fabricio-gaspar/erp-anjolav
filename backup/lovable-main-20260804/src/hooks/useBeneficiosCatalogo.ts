import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BeneficioCatalogo {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
}

export const CORES_BENEFICIO: { value: string; label: string; className: string; dot: string }[] = [
  { value: "blue", label: "Azul", className: "bg-blue-100 text-blue-800 border-blue-300/60 dark:bg-blue-900/40 dark:text-blue-200", dot: "bg-blue-500" },
  { value: "green", label: "Verde", className: "bg-green-100 text-green-800 border-green-300/60 dark:bg-green-900/40 dark:text-green-200", dot: "bg-green-500" },
  { value: "orange", label: "Laranja", className: "bg-orange-100 text-orange-800 border-orange-300/60 dark:bg-orange-900/40 dark:text-orange-200", dot: "bg-orange-500" },
  { value: "rose", label: "Rosa", className: "bg-rose-100 text-rose-800 border-rose-300/60 dark:bg-rose-900/40 dark:text-rose-200", dot: "bg-rose-500" },
  { value: "cyan", label: "Ciano", className: "bg-cyan-100 text-cyan-800 border-cyan-300/60 dark:bg-cyan-900/40 dark:text-cyan-200", dot: "bg-cyan-500" },
  { value: "amber", label: "Âmbar", className: "bg-amber-100 text-amber-800 border-amber-300/60 dark:bg-amber-900/40 dark:text-amber-200", dot: "bg-amber-500" },
  { value: "purple", label: "Roxo", className: "bg-purple-100 text-purple-800 border-purple-300/60 dark:bg-purple-900/40 dark:text-purple-200", dot: "bg-purple-500" },
  { value: "slate", label: "Cinza", className: "bg-slate-100 text-slate-800 border-slate-300/60 dark:bg-slate-800/60 dark:text-slate-200", dot: "bg-slate-500" },
];

export const corClasses = (c?: string) =>
  CORES_BENEFICIO.find((x) => x.value === c)?.className || CORES_BENEFICIO[7].className;
export const corDot = (c?: string) =>
  CORES_BENEFICIO.find((x) => x.value === c)?.dot || CORES_BENEFICIO[7].dot;

export function useBeneficiosCatalogo() {
  return useQuery({
    queryKey: ["beneficios_catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beneficios_catalogo" as any)
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as BeneficioCatalogo[];
    },
    refetchOnMount: "always",
  });
}

export function useUpsertBeneficioCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: Partial<BeneficioCatalogo>) => {
      if (b.id) {
        const { error } = await supabase.from("beneficios_catalogo" as any).update(b).eq("id", b.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("beneficios_catalogo" as any).insert(b);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beneficios_catalogo"] });
      toast.success("Benefício salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBeneficioCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("beneficios_catalogo" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beneficios_catalogo"] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
