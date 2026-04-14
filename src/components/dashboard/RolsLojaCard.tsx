import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShoppingCart, Calendar as CalendarIcon, X, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatCurrencyInput } from "@/lib/currencyUtils";

const statusConfig: Record<string, { label: string; color: string }> = {
  retirada: { label: "Retirado", color: "bg-blue-100 text-blue-700 border-blue-200" },
  separacao: { label: "Separação", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  lavagem: { label: "Lavagem", color: "bg-purple-100 text-purple-700 border-purple-200" },
  secagem: { label: "Secagem", color: "bg-orange-100 text-orange-700 border-orange-200" },
  passadoria: { label: "Passadoria", color: "bg-pink-100 text-pink-700 border-pink-200" },
  embalagem: { label: "Embalagem", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  expedicao: { label: "Pronto", color: "bg-green-100 text-green-700 border-green-200" },
  entregue: { label: "Entregue", color: "bg-gray-100 text-gray-500 border-gray-200" },
};

export function RolsLojaCard() {
  const navigate = useNavigate();
  const [filtroTipo, setFiltroTipo] = useState<"retirada" | "entrega">("retirada");
  const [filtroData, setFiltroData] = useState<Date | null>(null);

  const { data: rols = [] } = useQuery({
    queryKey: ["rols_loja"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, status, data_retirada, data_previsao_entrega, valor_total, cliente:clientes(razao_social)")
        .eq("origem", "loja")
        .not("status", "in", "(cancelada)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const filteredRols = rols.filter((rol) => {
    if (!filtroData) return true;
    const campo = filtroTipo === "retirada" ? rol.data_retirada : rol.data_previsao_entrega;
    if (!campo) return false;
    return isSameDay(new Date(campo), filtroData);
  });

  const activeRols = filteredRols.filter((r) => r.status !== "entregue");
  const deliveredRols = filteredRols.filter((r) => r.status === "entregue");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            ROLs Loja
            <Badge variant="secondary" className="text-[10px] rounded-full">
              {activeRols.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant={filtroTipo === "retirada" ? "default" : "outline"}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setFiltroTipo("retirada")}
            >
              Retirada
            </Button>
            <Button
              variant={filtroTipo === "entrega" ? "default" : "outline"}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setFiltroTipo("entrega")}
            >
              Entrega
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={filtroData ? "default" : "outline"} size="sm" className="h-6 px-2">
                  <CalendarIcon className="w-3 h-3" />
                  {filtroData && (
                    <X
                      className="w-3 h-3 ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiltroData(null);
                      }}
                    />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={filtroData || undefined}
                  onSelect={(d) => setFiltroData(d || null)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {filteredRols.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Package className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">Nenhum ROL encontrado</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
            {[...activeRols, ...deliveredRols].map((rol) => {
              const cfg = statusConfig[rol.status] || statusConfig.retirada;
              return (
                <div
                  key={rol.id}
                  onClick={() => navigate("/caixa")}
                  className="flex items-center justify-between gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono font-semibold text-primary whitespace-nowrap">
                      {rol.numero}
                    </span>
                    <span className="text-xs text-foreground truncate">
                      {rol.cliente?.razao_social || "Cliente"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {rol.data_previsao_entrega
                        ? format(new Date(rol.data_previsao_entrega), "dd/MM", { locale: ptBR })
                        : "-"}
                    </span>
                    {rol.valor_total != null && (
                      <span className="text-[10px] font-medium whitespace-nowrap">
                        R$ {Number(rol.valor_total).toFixed(2).replace(".", ",")}
                      </span>
                    )}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={cn("text-[9px] px-1.5 py-0 h-4 border", cfg.color)}
                    >
                      {cfg.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
