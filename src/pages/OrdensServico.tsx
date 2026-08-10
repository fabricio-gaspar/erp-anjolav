import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListaOS } from "@/components/ordens/ListaOS";
import { NovaOS } from "@/components/ordens/NovaOS";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function OrdensServico() {
  const { activeArea } = useWorkspace();
  const [activeTab, setActiveTab] = useState("lista");

  const handleNovaOS = () => {
    setActiveTab("nova");
  };

  const handleOSCreated = () => {
    setActiveTab("lista");
  };

  return (
    <AppLayout 
      title="Ordens de Serviço" 
      subtitle={`Criação e gerenciamento de pedidos - ${activeArea.charAt(0).toUpperCase() + activeArea.slice(1)}`}
    >
      <div className="w-full space-y-8">
        {/* Visual Content Header mirroring high-fidelity layout */}
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.6)] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500/90">PEDIDOS E SERVIÇOS</span>
          </div>
          <h1 className="text-5xl font-black tracking-tightest text-slate-900 leading-[0.95] uppercase">
            Ordens de Serviço
          </h1>
          <p className="text-[14px] text-slate-400 font-bold uppercase tracking-wider">
            Gestão consolidada de entradas e saídas de itens
          </p>
        </div>

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
    </div>
    </AppLayout>
  );
}
