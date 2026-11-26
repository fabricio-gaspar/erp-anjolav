import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Cliente, ConfiguracaoPagamentoCliente, EnderecoCliente } from "@/hooks/useClientes";
import type { PrecoEspecialComProduto, Produto } from "@/hooks/useProdutos";
import { getAllowedProductUnits } from "@/lib/workspaceScope";
import { clientClassificationValuesForArea } from "@/lib/operations";

const PAGE_SIZE = 500;

export interface OfflinePdvPackageStatus {
  generatedAt: string;
  area: "industrial" | "residencial";
  clients: number;
  products: number;
  specialPrices: number;
  paymentConfigurations: number;
  addresses: number;
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message?: string } | null }>;

interface OfflineQuery<T> extends PageResult<T> {
  select(columns?: string): OfflineQuery<T>;
  eq(column: string, value: unknown): OfflineQuery<T>;
  in(column: string, values: readonly unknown[]): OfflineQuery<T>;
  order(column: string, options?: { ascending?: boolean }): OfflineQuery<T>;
  range(from: number, to: number): OfflineQuery<T>;
}

// Evita que o TypeScript expanda todos os relacionamentos do schema gerado
// nestas consultas paginadas. A validação real continua sendo feita pelo
// PostgREST/RLS e os resultados mantêm tipos explícitos por tabela.
const offlineDb = supabase as unknown as {
  from<T>(table: string): OfflineQuery<T>;
};

async function fetchAllPages<T>(load: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const result: T[] = [];
  for (let page = 0; page < 200; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message || "Não foi possível preparar os dados offline");
    const rows = data ?? [];
    result.push(...rows);
    if (rows.length < PAGE_SIZE) return result;
  }
  throw new Error("O pacote offline excedeu o limite seguro de registros");
}

function groupByClient<T extends { cliente_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const current = grouped.get(row.cliente_id) ?? [];
    current.push(row);
    grouped.set(row.cliente_id, current);
  }
  return grouped;
}

export async function refreshOfflinePdvPackage(input: {
  queryClient: QueryClient;
  userId: string;
  tenantId: string;
  area: "industrial" | "residencial";
}): Promise<OfflinePdvPackageStatus> {
  const { queryClient, userId, tenantId, area } = input;
  const allowedUnits = getAllowedProductUnits(area);

  const [clients, products, specialPrices, paymentConfigurations, addresses] = await Promise.all([
    fetchAllPages<Cliente>((from, to) => offlineDb
      .from<Cliente>("clientes")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("classificacao", clientClassificationValuesForArea(area))
      .order("razao_social")
      .range(from, to) as unknown as PageResult<Cliente>),
    fetchAllPages<Produto>((from, to) => {
      let query = offlineDb
        .from<Produto>("produtos")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("nome");
      if (allowedUnits) query = query.in("unidade_negocio", [...allowedUnits]);
      return query.range(from, to) as unknown as PageResult<Produto>;
    }),
    fetchAllPages<PrecoEspecialComProduto>((from, to) => offlineDb
      .from<PrecoEspecialComProduto>("precos_especiais")
      .select("*, produto:produtos!fk_precos_especiais_produto(nome, unidade, preco)")
      .eq("tenant_id", tenantId)
      .range(from, to) as unknown as PageResult<PrecoEspecialComProduto>),
    fetchAllPages<ConfiguracaoPagamentoCliente>((from, to) => offlineDb
      .from<ConfiguracaoPagamentoCliente>("configuracoes_pagamento_cliente")
      .select("*")
      .eq("tenant_id", tenantId)
      .range(from, to) as unknown as PageResult<ConfiguracaoPagamentoCliente>),
    fetchAllPages<EnderecoCliente>((from, to) => offlineDb
      .from<EnderecoCliente>("enderecos_clientes")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("ativo", { ascending: false })
      .order("principal", { ascending: false })
      .order("updated_at", { ascending: false })
      .range(from, to) as unknown as PageResult<EnderecoCliente>),
  ]);

  const activeClients = clients.filter((client) => client.ativo);
  const allowedClientIds = new Set(activeClients.map((client) => client.id));
  const scopedPrices = specialPrices.filter((price) => allowedClientIds.has(price.cliente_id));
  const scopedConfigurations = paymentConfigurations.filter((configuration) => allowedClientIds.has(configuration.cliente_id));
  const scopedAddresses = addresses.filter((address) => allowedClientIds.has(address.cliente_id));
  const priceByClient = groupByClient(scopedPrices);
  const addressByClient = groupByClient(scopedAddresses);
  const configurationByClient = new Map(scopedConfigurations.map((configuration) => [configuration.cliente_id, configuration]));

  queryClient.setQueryData(["clientes", userId, tenantId, area], clients);
  queryClient.setQueryData(["produtos", userId, tenantId, area], products);
  for (const client of activeClients) {
    queryClient.setQueryData(["precos_especiais", userId, tenantId, client.id], priceByClient.get(client.id) ?? []);
    queryClient.setQueryData(["configuracao_pagamento_cliente", userId, tenantId, client.id], configurationByClient.get(client.id) ?? null);
    queryClient.setQueryData(["endereco_cliente", userId, tenantId, client.id], addressByClient.get(client.id) ?? []);
  }

  const status: OfflinePdvPackageStatus = {
    generatedAt: new Date().toISOString(),
    area,
    clients: activeClients.length,
    products: products.length,
    specialPrices: scopedPrices.length,
    paymentConfigurations: scopedConfigurations.length,
    addresses: scopedAddresses.length,
  };
  queryClient.setQueryData(["offline-pdv-package", userId, tenantId, area], status);
  return status;
}
