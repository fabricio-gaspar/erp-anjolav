import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const usePermissoesUsuario = () => {
  const { funcionario } = useAuth();

  return useQuery({
    queryKey: ["permissoes-usuario", funcionario?.id],
    queryFn: async () => {
      if (!funcionario?.id) return null;

      const { data, error } = await supabase
        .from("modulo_permissoes")
        .select("modulo_key, tem_acesso")
        .eq("funcionario_id", funcionario.id);

      if (error) throw error;

      // Build a map of module_key -> tem_acesso
      const map: Record<string, boolean> = {};
      data?.forEach((p) => {
        map[p.modulo_key] = p.tem_acesso;
      });
      return map;
    },
    enabled: !!funcionario?.id,
  });
};

// Map route paths to permission module keys
const ROUTE_PERMISSION_MAP: Record<string, string> = {
  "/": "dashboard",
  "/clientes": "clientes",
  "/produtos": "produtos",
  "/fornecedores": "clientes", // same group as clientes
  "/ordens": "ordens",
  "/producao": "producao",
  "/agenda": "agenda",
  "/estoque": "produtos", // same group as produtos
  "/financeiro": "faturamento",
  "/lancamentos": "faturamento",
  "/caixa": "caixa",
  "/contas": "contas_pagar", // contas page has both
  "/relatorios/clientes": "relatorios",
  "/relatorios/proximidade": "relatorios",
  "/configuracoes": "configuracoes",
};

export const useTemPermissao = (route: string): boolean => {
  const { data: permissoes, isLoading } = usePermissoesUsuario();
  const { funcionario } = useAuth();

  // Admin always has access
  if (funcionario?.cargo === "ADMINISTRADOR") return true;

  // While loading or no permissions set, show all (permissive default)
  if (isLoading || !permissoes) return true;

  // If no permissions configured at all for this user, show all
  if (Object.keys(permissoes).length === 0) return true;

  const moduleKey = ROUTE_PERMISSION_MAP[route];
  if (!moduleKey) return true; // unknown route = allow

  return permissoes[moduleKey] !== false;
};
