import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Package, 
  Truck, 
  Calendar, 
  FileText, 
  Phone, 
  Mail, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { LancarProdutosModal } from "@/components/portal/LancarProdutosModal";
import { useLancamentosCliente } from "@/hooks/useLancamentoCliente";
import { 
  usePortalOrdens, 
  usePortalFaturas, 
  usePortalEstatisticas,
  usePortalAlertas 
} from "@/hooks/usePortalData";
import { AlertasPortal } from "@/components/portal/AlertasPortal";
import { EstatisticasCliente } from "@/components/portal/EstatisticasCliente";
import { AcompanhamentoProducao } from "@/components/portal/AcompanhamentoProducao";
import { CentralDocumentos } from "@/components/portal/CentralDocumentos";

const PortalCliente = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const [showLancarModal, setShowLancarModal] = useState(false);

  // Buscar configuração do cliente pelo código de acesso
  const { data: config, isLoading: isLoadingConfig, error } = useQuery({
    queryKey: ["portal-cliente", codigo],
    queryFn: async () => {
      if (!codigo) throw new Error("Código não informado");

      const { data, error } = await supabase
        .from("configuracoes_cliente")
        .select("*, cliente:clientes(*)")
        .eq("codigo_acesso", codigo.toUpperCase())
        .single();

      if (error || !data) throw new Error("Código de acesso inválido");
      return data;
    },
    enabled: !!codigo,
    retry: false,
  });

  // Buscar configurações gerais da empresa
  const { data: configGeral } = useQuery({
    queryKey: ["configuracoes-gerais-portal"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_gerais")
        .select("*")
        .limit(1)
        .single();
      return data;
    },
  });

  // Hooks do portal (novos)
  const clienteId = config?.cliente_id || null;
  const { data: ordens = [], isLoading: isLoadingOrdens } = usePortalOrdens(clienteId);
  const { data: faturas = [], isLoading: isLoadingFaturas } = usePortalFaturas(clienteId);
  const { data: estatisticas, isLoading: isLoadingEstatisticas } = usePortalEstatisticas(clienteId);
  const alertas = usePortalAlertas(clienteId, ordens, faturas);

  // Buscar próximos agendamentos
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["portal-agendamentos", clienteId],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("cliente_id", clienteId)
        .gte("data", hoje)
        .order("data", { ascending: true })
        .limit(4);
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Buscar lançamentos feitos pelo cliente no portal
  const { data: lancamentosCliente = [] } = useLancamentosCliente(clienteId);

  // Buscar produtos disponíveis para o cliente
  const { data: produtos = [] } = useQuery({
    queryKey: ["portal-produtos", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      // Primeiro buscar preços especiais do cliente
      const { data: precosEspeciais } = await supabase
        .from("precos_especiais")
        .select("produto_id")
        .eq("cliente_id", clienteId);

      const produtoIds = precosEspeciais?.map((p) => p.produto_id) || [];

      // Se tiver preços especiais, buscar esses produtos
      // Senão, buscar todos os produtos ativos
      let query = supabase
        .from("produtos")
        .select("id, nome, unidade")
        .eq("status", "ativo")
        .order("nome");

      if (produtoIds.length > 0) {
        query = query.in("id", produtoIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  if (isLoadingConfig) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
            <p className="text-muted-foreground">
              O código de acesso informado é inválido ou expirou.
            </p>
            <p className="text-sm text-muted-foreground">
              Código: <span className="font-mono font-bold">{codigo}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Entre em contato com a lavanderia para obter um novo código de acesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cliente = config.cliente as any;
  const nomeEmpresa = configGeral?.nome_empresa || "Lavanderia";
  const nomeExibicao = cliente?.nome_fantasia || cliente?.razao_social;

  const formatarData = (data: string) => {
    return format(new Date(data), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatarHorario = (horario: string | null) => {
    if (!horario) return "";
    return horario.substring(0, 5);
  };

  const getLancamentoClienteStatus = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Aguardando</Badge>;
      case "conferido":
        return <Badge className="bg-green-600 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />Conferido</Badge>;
      case "divergente":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Divergência</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTipoAgendamento = (tipo: string) => {
    return tipo === "retirada" ? (
      <span className="flex items-center gap-1 text-primary">
        <Truck className="w-4 h-4" /> Retirada
      </span>
    ) : (
      <span className="flex items-center gap-1 text-primary">
        <Package className="w-4 h-4" /> Entrega
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {configGeral?.logo_url && (
                <img 
                  src={configGeral.logo_url} 
                  alt="Logo" 
                  className="h-10 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="text-lg font-bold text-foreground">{nomeEmpresa}</h1>
                <p className="text-xs text-muted-foreground">Portal do Cliente</p>
              </div>
            </div>
            <Badge variant="outline" className="hidden sm:flex">
              {nomeExibicao}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bem-vindo(a),</p>
                  <h2 className="text-xl font-bold text-foreground">
                    {nomeExibicao}
                  </h2>
                </div>
              </div>
              <Button onClick={() => setShowLancarModal(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Lançar Produtos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Container principal com fundo branco */}
        <Card className="bg-background/95 border-border/50 shadow-sm">
          <CardContent className="p-6 space-y-6">
            {/* Alertas */}
            {alertas.length > 0 && <AlertasPortal alertas={alertas} />}

            {/* Estatísticas */}
            <EstatisticasCliente 
              estatisticas={estatisticas} 
              isLoading={isLoadingEstatisticas} 
            />

            <Separator />

            {/* Acompanhamento de Produção */}
            <AcompanhamentoProducao 
              ordens={ordens} 
              isLoading={isLoadingOrdens} 
            />

            <Separator />

            {/* Central de Documentos */}
            <CentralDocumentos 
              faturas={faturas} 
              isLoading={isLoadingFaturas}
              clienteNome={cliente?.razao_social || cliente?.nome_fantasia || ""}
              empresaNome={configGeral?.nome_empresa || undefined}
              logoUrl={configGeral?.logo_url || undefined}
            />

            <Separator />

            {/* Lançamentos do Cliente Pendentes + Próximos Agendamentos */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Lançamentos do Cliente */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Meus Lançamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lancamentosCliente.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Nenhum lançamento registrado
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowLancarModal(true)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Lançar Produtos
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lancamentosCliente.slice(0, 5).map((lancamento) => (
                        <div
                          key={lancamento.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {format(new Date(lancamento.created_at), "dd/MM/yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lancamento.itens?.length || 0} itens •{" "}
                              {lancamento.itens?.reduce((acc, item) => acc + item.quantidade, 0) || 0}{" "}
                              peças
                            </p>
                          </div>
                          {getLancamentoClienteStatus(lancamento.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Próximos Agendamentos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Próximos Agendamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {agendamentos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum agendamento programado.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {agendamentos.map((agendamento: any) => (
                        <div
                          key={agendamento.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getTipoAgendamento(agendamento.tipo)}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">
                              {formatarData(agendamento.data)}
                            </p>
                            {agendamento.horario && (
                              <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                <Clock className="w-3 h-3" />
                                {formatarHorario(agendamento.horario)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              {configGeral?.whatsapp_numero && (
                <a
                  href={`https://wa.me/55${configGeral.whatsapp_numero.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {configGeral.whatsapp_numero}
                </a>
              )}
              {cliente?.email && (
                <a
                  href={`mailto:${cliente.email}`}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {cliente.email}
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {nomeEmpresa}. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Modal de Lançamento de Produtos */}
      {cliente && (
        <LancarProdutosModal
          open={showLancarModal}
          onClose={() => setShowLancarModal(false)}
          clienteId={cliente.id}
          clienteNome={nomeExibicao}
          produtos={produtos}
        />
      )}
    </div>
  );
};

export default PortalCliente;
