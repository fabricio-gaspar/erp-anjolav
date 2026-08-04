import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientes, useEnderecoCliente } from "@/hooks/useClientes";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { calcularDistanciaKm } from "@/services/apiServices";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  Navigation,
  Building2,
  Filter,
  Download,
  Truck,
  ArrowUpDown,
  Route,
  Search,
} from "lucide-react";

interface ClienteComDistancia {
  id: string;
  nome: string;
  endereco: string;
  bairro: string | null;
  cidade: string | null;
  latitude: number | null;
  longitude: number | null;
  distancia: number | null;
  ativo: boolean;
}

const RelatorioProximidade = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroDistancia, setFiltroDistancia] = useState<string>("todas");
  const [ordenacao, setOrdenacao] = useState<"asc" | "desc">("asc");

  const { clientes, isLoading: loadingClientes } = useClientes();
  const { configuracao, isLoading: loadingConfig } = useConfiguracoesGerais();

  // Buscar todos os endereços de clientes
  const { data: enderecos, isLoading: loadingEnderecos } = useQuery({
    queryKey: ["enderecos_clientes_todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enderecos_clientes")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const empresaLat = configuracao?.endereco_latitude;
  const empresaLng = configuracao?.endereco_longitude;

  // Calcular distâncias para todos os clientes
  const clientesComDistancia = useMemo<ClienteComDistancia[]>(() => {
    if (!clientes || !enderecos) return [];

    return clientes.map((cliente) => {
      const endereco = enderecos.find((e) => e.cliente_id === cliente.id);
      
      let distancia: number | null = null;
      if (
        empresaLat &&
        empresaLng &&
        endereco?.latitude &&
        endereco?.longitude
      ) {
        distancia = calcularDistanciaKm(
          empresaLat,
          empresaLng,
          Number(endereco.latitude),
          Number(endereco.longitude)
        );
      }

      const enderecoCompleto = endereco
        ? `${endereco.logradouro || ""}, ${endereco.numero || ""}`
        : "Endereço não cadastrado";

      return {
        id: cliente.id,
        nome: cliente.nome_fantasia || cliente.razao_social,
        endereco: enderecoCompleto,
        bairro: endereco?.bairro || null,
        cidade: endereco?.cidade || null,
        latitude: endereco?.latitude ? Number(endereco.latitude) : null,
        longitude: endereco?.longitude ? Number(endereco.longitude) : null,
        distancia,
        ativo: cliente.ativo,
      };
    });
  }, [clientes, enderecos, empresaLat, empresaLng]);

  // Filtrar e ordenar
  const clientesFiltrados = useMemo(() => {
    let resultado = clientesComDistancia.filter((c) => c.ativo);

    // Filtro de busca
    if (searchTerm) {
      const termo = searchTerm.toLowerCase();
      resultado = resultado.filter(
        (c) =>
          c.nome.toLowerCase().includes(termo) ||
          c.endereco.toLowerCase().includes(termo) ||
          c.bairro?.toLowerCase().includes(termo) ||
          c.cidade?.toLowerCase().includes(termo)
      );
    }

    // Filtro por distância
    if (filtroDistancia !== "todas") {
      const maxDist = parseInt(filtroDistancia);
      resultado = resultado.filter(
        (c) => c.distancia !== null && c.distancia <= maxDist
      );
    }

    // Ordenação
    resultado.sort((a, b) => {
      if (a.distancia === null && b.distancia === null) return 0;
      if (a.distancia === null) return 1;
      if (b.distancia === null) return -1;
      return ordenacao === "asc"
        ? a.distancia - b.distancia
        : b.distancia - a.distancia;
    });

    return resultado;
  }, [clientesComDistancia, searchTerm, filtroDistancia, ordenacao]);

  // Estatísticas
  const estatisticas = useMemo(() => {
    const comDistancia = clientesComDistancia.filter((c) => c.distancia !== null);
    if (comDistancia.length === 0) {
      return { total: 0, media: 0, menor: 0, maior: 0, ate5km: 0, ate10km: 0, acima10km: 0 };
    }

    const distancias = comDistancia.map((c) => c.distancia!);
    const soma = distancias.reduce((acc, d) => acc + d, 0);

    return {
      total: comDistancia.length,
      media: soma / comDistancia.length,
      menor: Math.min(...distancias),
      maior: Math.max(...distancias),
      ate5km: comDistancia.filter((c) => c.distancia! <= 5).length,
      ate10km: comDistancia.filter((c) => c.distancia! > 5 && c.distancia! <= 10).length,
      acima10km: comDistancia.filter((c) => c.distancia! > 10).length,
    };
  }, [clientesComDistancia]);

  const getBadgeVariant = (distancia: number | null) => {
    if (distancia === null) return "secondary";
    if (distancia <= 5) return "default";
    if (distancia <= 10) return "secondary";
    return "destructive";
  };

  const isLoading = loadingClientes || loadingConfig || loadingEnderecos;

  const exportarCSV = () => {
    const headers = ["Ordem", "Cliente", "Endereço", "Bairro", "Cidade", "Distância (km)"];
    const rows = clientesFiltrados.map((c, i) => [
      i + 1,
      c.nome,
      c.endereco,
      c.bairro || "",
      c.cidade || "",
      c.distancia?.toFixed(2) || "N/A",
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-proximidade.csv";
    link.click();
  };

  return (
    <AppLayout title="Relatório de Proximidade">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Route className="w-6 h-6 text-primary" />
              Relatório de Proximidade
            </h1>
            <p className="text-sm text-muted-foreground">
              Clientes ordenados por distância da empresa para otimizar rotas
            </p>
          </div>
          <Button onClick={exportarCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Endereço da Empresa */}
        {configuracao?.endereco_logradouro && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ponto de Referência (Empresa)</p>
                  <p className="font-medium">
                    {configuracao.endereco_logradouro}, {configuracao.endereco_numero}
                    {configuracao.endereco_bairro && ` - ${configuracao.endereco_bairro}`}
                    {configuracao.endereco_cidade && `, ${configuracao.endereco_cidade}`}
                    {configuracao.endereco_uf && `/${configuracao.endereco_uf}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-foreground">{estatisticas.total}</p>
              <p className="text-xs text-muted-foreground">Total Clientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {estatisticas.media.toFixed(1)} km
              </p>
              <p className="text-xs text-muted-foreground">Distância Média</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {estatisticas.menor.toFixed(1)} km
              </p>
              <p className="text-xs text-muted-foreground">Mais Próximo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-red-600">
                {estatisticas.maior.toFixed(1)} km
              </p>
              <p className="text-xs text-muted-foreground">Mais Distante</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/20">
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-green-600">{estatisticas.ate5km}</p>
              <p className="text-xs text-muted-foreground">Até 5 km</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/20">
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-red-600">{estatisticas.acima10km}</p>
              <p className="text-xs text-muted-foreground">Acima 10 km</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente, endereço, bairro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={filtroDistancia} onValueChange={setFiltroDistancia}>
                  <SelectTrigger className="w-40">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="5">Até 5 km</SelectItem>
                    <SelectItem value="10">Até 10 km</SelectItem>
                    <SelectItem value="20">Até 20 km</SelectItem>
                    <SelectItem value="50">Até 50 km</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => setOrdenacao(ordenacao === "asc" ? "desc" : "asc")}
                  className="gap-2"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  {ordenacao === "asc" ? "Menor → Maior" : "Maior → Menor"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Clientes por Proximidade
              <Badge variant="secondary" className="ml-2">
                {clientesFiltrados.length} clientes
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : !empresaLat || !empresaLng ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Configure o endereço da empresa em{" "}
                  <a href="/configuracoes" className="text-primary underline">
                    Configurações Gerais
                  </a>{" "}
                  para calcular distâncias.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">Endereço</TableHead>
                      <TableHead className="hidden md:table-cell">Bairro</TableHead>
                      <TableHead className="hidden lg:table-cell">Cidade</TableHead>
                      <TableHead className="text-right">Distância</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum cliente encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientesFiltrados.map((cliente, index) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">{cliente.nome}</TableCell>
                          <TableCell className="text-muted-foreground hidden sm:table-cell">
                            {cliente.endereco}
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden md:table-cell">
                            {cliente.bairro || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden lg:table-cell">
                            {cliente.cidade || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {cliente.distancia !== null ? (
                              <Badge variant={getBadgeVariant(cliente.distancia)}>
                                <Navigation className="w-3 h-3 mr-1" />
                                {cliente.distancia.toFixed(1)} km
                              </Badge>
                            ) : (
                              <Badge variant="outline">Sem coordenadas</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default RelatorioProximidade;
