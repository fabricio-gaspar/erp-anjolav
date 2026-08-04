import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, Calendar, Truck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useFilteredOrdensServico } from "@/hooks/useFilteredOrdensServico";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function FinalizadasLista() {
  const { activeArea } = useWorkspace();
  const { data: ordensServico = [] } = useFilteredOrdensServico();
  const [data, setData] = useState(() => new Date().toISOString().split("T")[0]);

  const aguardandoEntrega = useMemo(
    () => ordensServico.filter((os) => os.status === "expedicao"),
    [ordensServico]
  );

  const entregues = useMemo(
    () =>
      ordensServico.filter(
        (os) => os.status === "entregue" && os.updated_at?.split("T")[0] === data
      ),
    [ordensServico, data]
  );

  return (
    <Tabs defaultValue="aguardando" className="w-full">
      <TabsList>
        <TabsTrigger value="aguardando">
          <Truck className="w-3.5 h-3.5 mr-1" />
          Aguardando entrega ({aguardandoEntrega.length})
        </TabsTrigger>
        <TabsTrigger value="finalizadas">
          <CheckCircle className="w-3.5 h-3.5 mr-1" />
          Finalizadas ({entregues.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="aguardando" className="mt-3">
        <ListaSimples lista={aguardandoEntrega} vazio="Nenhuma OS aguardando entrega" />
      </TabsContent>

      <TabsContent value="finalizadas" className="mt-3 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-8 w-auto"
          />
        </div>
        <ListaSimples lista={entregues} vazio="Nenhuma OS finalizada nesta data" />
      </TabsContent>
    </Tabs>
  );
}

function ListaSimples({
  lista,
  vazio,
}: {
  lista: ReturnType<typeof useOrdensServico>["ordensServico"];
  vazio: string;
}) {
  if (lista.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{vazio}</p>;
  }
  return (
    <div className="border rounded-lg divide-y">
      {lista.map((os) => (
        <div key={os.id} className="flex items-center justify-between p-3 hover:bg-muted/30">
          <div>
            <p className="text-sm font-mono text-primary">{os.numero}</p>
            <p className="text-sm font-medium">{os.cliente?.razao_social || "—"}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {os.data_entrega
              ? format(new Date(os.data_entrega), "dd/MM HH:mm", { locale: ptBR })
              : format(new Date(os.updated_at), "dd/MM HH:mm", { locale: ptBR })}
          </div>
        </div>
      ))}
    </div>
  );
}
