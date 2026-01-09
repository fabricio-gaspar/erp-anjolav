import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListaOS } from "@/components/ordens/ListaOS";
import { NovaOS } from "@/components/ordens/NovaOS";

export default function OrdensServico() {
  const [activeTab, setActiveTab] = useState("lista");

  const handleNovaOS = () => {
    setActiveTab("nova");
  };

  return (
    <AppLayout title="Ordens de Serviço">
      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Abrir Retirada</h2>
            <p className="text-sm text-muted-foreground">
              Criação e gerenciamento de pedidos
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-transparent border-b w-full justify-start rounded-none h-auto p-0 mb-6">
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
              <NovaOS />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
