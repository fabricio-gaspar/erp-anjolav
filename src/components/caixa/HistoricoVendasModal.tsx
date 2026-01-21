import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Printer,
  FileText,
  Package,
  Calendar,
  Clock,
  RefreshCw,
  Banknote,
  Smartphone,
  CreditCard,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HistoricoVendasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caixaId: string;
  onImprimirROL?: (osId: string) => void;
  onImprimirEtiquetas?: (osId: string) => void;
}

interface VendaDoDia {
  id: string;
  numero: string;
  cliente_nome: string;
  valor_total: number;
  status_pagamento: string;
  forma_pagamento: string | null;
  created_at: string;
  total_pecas: number;
}

export function HistoricoVendasModal({
  open,
  onOpenChange,
  caixaId,
  onImprimirROL,
  onImprimirEtiquetas,
}: HistoricoVendasModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Buscar vendas do caixa atual através das movimentações
  const { data: vendas = [], isLoading, refetch } = useQuery({
    queryKey: ["vendas-do-dia", caixaId],
    queryFn: async () => {
      // Buscar movimentações de venda do caixa
      const { data: movimentacoes, error: movError } = await supabase
        .from("caixa_movimentacoes")
        .select("*")
        .eq("caixa_id", caixaId)
        .eq("tipo", "VENDA")
        .order("created_at", { ascending: false });

      if (movError) throw movError;

      // Extrair números de OS das descrições
      const osNumeros = (movimentacoes || [])
        .map((m) => {
          const match = m.descricao?.match(/OS\s*(\d+)/i);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      if (osNumeros.length === 0) return [];

      // Buscar as OS correspondentes
      const { data: ordens, error: osError } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          numero,
          valor_total,
          status_pagamento,
          forma_pagamento,
          created_at,
          clientes(razao_social, nome_fantasia),
          itens_ordem_servico(quantidade)
        `)
        .in("numero", osNumeros);

      if (osError) throw osError;

      return (ordens || []).map((os: any) => ({
        id: os.id,
        numero: os.numero,
        cliente_nome: os.clientes?.nome_fantasia || os.clientes?.razao_social || "Cliente",
        valor_total: Number(os.valor_total) || 0,
        status_pagamento: os.status_pagamento,
        forma_pagamento: os.forma_pagamento,
        created_at: os.created_at,
        total_pecas: (os.itens_ordem_servico || []).reduce(
          (acc: number, item: { quantidade: number }) => acc + (Number(item.quantidade) || 0),
          0
        ),
      }));
    },
    enabled: open && !!caixaId,
  });

  const filteredVendas = useMemo(() => {
    if (!searchTerm) return vendas;
    const term = searchTerm.toLowerCase();
    return vendas.filter(
      (v) =>
        v.numero.includes(term) ||
        v.cliente_nome.toLowerCase().includes(term)
    );
  }, [vendas, searchTerm]);

  const totais = useMemo(() => {
    return {
      qtdVendas: vendas.length,
      valorTotal: vendas.reduce((acc, v) => acc + v.valor_total, 0),
      totalPecas: vendas.reduce((acc, v) => acc + v.total_pecas, 0),
    };
  }, [vendas]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getFormaPagamentoIcon = (forma: string | null) => {
    switch (forma) {
      case "DINHEIRO":
        return <Banknote className="w-3 h-3" />;
      case "PIX":
        return <Smartphone className="w-3 h-3" />;
      case "CARTAO_CREDITO":
      case "CARTAO_DEBITO":
        return <CreditCard className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getFormaPagamentoLabel = (forma: string | null) => {
    switch (forma) {
      case "DINHEIRO":
        return "Dinheiro";
      case "PIX":
        return "PIX";
      case "CARTAO_CREDITO":
        return "Crédito";
      case "CARTAO_DEBITO":
        return "Débito";
      default:
        return "Pendente";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Vendas do Dia (F6)
          </DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Vendas</p>
            <p className="text-xl font-bold text-primary">{totais.qtdVendas}</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-success">{formatCurrency(totais.valorTotal)}</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Peças</p>
            <p className="text-xl font-bold text-foreground">{totais.totalPecas}</p>
          </div>
        </div>

        {/* Busca e Atualizar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por OS ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Lista de Vendas */}
        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredVendas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mb-2 opacity-50" />
              <p>Nenhuma venda encontrada</p>
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {filteredVendas.map((venda) => (
                <div
                  key={venda.id}
                  className="bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">
                          OS #{venda.numero}
                        </span>
                        <Badge
                          variant={venda.status_pagamento === "pago" ? "default" : "secondary"}
                          className="text-[10px] h-5"
                        >
                          {venda.status_pagamento === "pago" ? "Pago" : "Pendente"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                        {venda.cliente_nome}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success">
                        {formatCurrency(venda.valor_total)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                        {getFormaPagamentoIcon(venda.forma_pagamento)}
                        <span>{getFormaPagamentoLabel(venda.forma_pagamento)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {venda.total_pecas} peças
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(venda.created_at), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onImprimirROL?.(venda.id)}
                      >
                        <Printer className="w-3 h-3 mr-1" />
                        ROL
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onImprimirEtiquetas?.(venda.id)}
                      >
                        <Printer className="w-3 h-3 mr-1" />
                        Etiquetas
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
