import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GlobalSearchResult {
  id: string;
  type: "cliente" | "produto" | "fornecedor" | "ordem" | "lancamento";
  label: string;
  sublabel?: string;
  route: string;
}

export const useGlobalSearch = (term: string) => {
  const trimmed = term.trim();
  return useQuery({
    queryKey: ["global-search", trimmed],
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<GlobalSearchResult[]> => {
      const t = `%${trimmed}%`;
      const [clientes, produtos, fornecedores, ordens, lancamentos] = await Promise.all([
        supabase.from("clientes").select("id,razao_social,nome_fantasia,cpf_cnpj").or(`razao_social.ilike.${t},nome_fantasia.ilike.${t},cpf_cnpj.ilike.${t}`).limit(5),
        supabase.from("produtos").select("id,nome,codigo").or(`nome.ilike.${t},codigo.ilike.${t}`).limit(5),
        supabase.from("fornecedores").select("id,nome,cnpj_cpf").or(`nome.ilike.${t},cnpj_cpf.ilike.${t}`).limit(5),
        supabase.from("ordens_servico").select("id,numero,cliente:clientes(razao_social)").ilike("numero", t).limit(5),
        supabase.from("lancamentos").select("id,numero_rol,cliente:clientes(razao_social)").ilike("numero_rol", t).limit(5),
      ]);

      const out: GlobalSearchResult[] = [];

      clientes.data?.forEach((c: any) => out.push({
        id: c.id, type: "cliente",
        label: c.razao_social || c.nome_fantasia || "Cliente",
        sublabel: c.cpf_cnpj || undefined,
        route: `/clientes?id=${c.id}`,
      }));
      produtos.data?.forEach((p: any) => out.push({
        id: p.id, type: "produto",
        label: p.nome,
        sublabel: p.codigo || undefined,
        route: `/produtos?id=${p.id}`,
      }));
      fornecedores.data?.forEach((f: any) => out.push({
        id: f.id, type: "fornecedor",
        label: f.nome,
        sublabel: f.cnpj_cpf || undefined,
        route: `/fornecedores?id=${f.id}`,
      }));
      ordens.data?.forEach((o: any) => out.push({
        id: o.id, type: "ordem",
        label: `OS ${o.numero}`,
        sublabel: o.cliente?.razao_social,
        route: `/ordens?id=${o.id}`,
      }));
      lancamentos.data?.forEach((l: any) => out.push({
        id: l.id, type: "lancamento",
        label: l.numero_rol,
        sublabel: l.cliente?.razao_social,
        route: `/lancamentos?id=${l.id}`,
      }));

      return out;
    },
  });
};
