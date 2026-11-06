import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListaOS } from "@/components/ordens/ListaOS";
import { NovaOS } from "@/components/ordens/NovaOS";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Plus } from "lucide-react";

export default function OrdensServico() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeArea } = useWorkspace();
  const [activeTab, setActiveTab] = useState("lista");

  useEffect(() => {
    if (searchParams.get("novo") !== "1") return;
    setActiveTab("nova");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("novo");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleNovaOS = () => {
    setActiveTab("nova");
  };

  const handleOSCreated = () => {
    setActiveTab("lista");
  };

  return (
    <AppLayout 
      title="Pedidos"
      subtitle={`Atendimento, produção e entrega - ${activeArea.charAt(0).toUpperCase() + activeArea.slice(1)}`}
    >
      <div className="page-shell">
        <PageHeader
          eyebrow="Pedidos e serviços"
          title="Pedidos"
          description="Acompanhe operação, pagamento, qualidade, logística e histórico em uma única ficha"
          actions={(
            <Button onClick={handleNovaOS} className="w-full gap-2 font-bold sm:w-auto">
              <Plus className="h-4 w-4" />Novo pedido
            </Button>
          )}
        />

        <div className="content-panel">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="page-tabs-list mb-3">
              <TabsTrigger
                value="lista"
                className="page-tab-trigger"
              >
                Lista
              </TabsTrigger>
              <TabsTrigger
                value="nova"
                className="page-tab-trigger"
              >
                Novo pedido
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lista" className="mt-0">
              <ListaOS onNovaOS={handleNovaOS} />
            </TabsContent>

            <TabsContent value="nova" className="mt-0">
              <NovaOS onSuccess={handleOSCreated} />
            </TabsContent>
          </Tabs>
      </div>
    </div>
    </AppLayout>
  );
}
