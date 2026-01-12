import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListaOS } from "@/components/ordens/ListaOS";
import { NovaOS } from "@/components/ordens/NovaOS";

export default function OrdensServico() {
  const [activeTab, setActiveTab] = useState("lista");

  const handleNovaOS = () => {
    setActiveTab("nova");
  };

  const handleOSCreated = () => {
    setActiveTab("lista");
  };

  return (
    <AppLayout title="Ordens de Serviço" subtitle="Criação e gerenciamento de pedidos">
      <div className="content-panel">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-transparent border-b w-full justify-start rounded-none h-auto p-0 mb-3">
              <TabsTrigger
                value="lista"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3"
              >
                Lista de OS
              </TabsTrigger>
              <TabsTrigger
                value="nova"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3"
              >
                Nova OS
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
    </AppLayout>
  );
}
