import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Truck, Calendar, FileText, Phone, Mail, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PortalCliente = () => {
  const { codigo } = useParams<{ codigo: string }>();

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

  // Buscar últimos lançamentos do cliente
  const { data: lancamentos = [] } = useQuery({
    queryKey: ["portal-lancamentos", config?.cliente_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lancamentos")
        .select("*, itens:itens_lancamento(*)")
        .eq("cliente_id", config?.cliente_id)
        .order("data_lancamento", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!config?.cliente_id,
  });

  // Buscar próximos agendamentos
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["portal-agendamentos", config?.cliente_id],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("cliente_id", config?.cliente_id)
        .gte("data", hoje)
        .order("data", { ascending: true })
        .limit(4);
      return data || [];
    },
    enabled: !!config?.cliente_id,
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

  const formatarData = (data: string) => {
    return format(new Date(data), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatarHorario = (horario: string | null) => {
    if (!horario) return "";
    return horario.substring(0, 5);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "faturado":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Faturado</Badge>;
      case "pendente":
        return <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
      <header className="bg-background border-b">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {configGeral?.logo_url && (
                <img 
                  src={configGeral.logo_url} 
                  alt="Logo" 
                  className="h-12 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="text-xl font-bold text-foreground">{nomeEmpresa}</h1>
                <p className="text-sm text-muted-foreground">Portal do Cliente</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bem-vindo(a),</p>
                <h2 className="text-xl font-bold text-foreground">
                  {cliente?.razao_social || cliente?.nome_fantasia}
                </h2>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Últimos Serviços */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Últimos Serviços
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lancamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum serviço encontrado.
                </p>
              ) : (
                <div className="space-y-3">
                  {lancamentos.map((lancamento: any) => (
                    <div
                      key={lancamento.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {formatarData(lancamento.data_lancamento)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lancamento.itens?.length || 0} itens
                        </p>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(lancamento.status)}
                        <p className="text-sm font-semibold mt-1">
                          R$ {Number(lancamento.valor_total || 0).toFixed(2)}
                        </p>
                      </div>
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

        {/* Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                Ver Relatório do Mês
              </Button>
              <Button variant="outline" className="gap-2">
                <Package className="w-4 h-4" />
                Histórico de Serviços
              </Button>
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
    </div>
  );
};

export default PortalCliente;
