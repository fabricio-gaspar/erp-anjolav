import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Package, Receipt, ClipboardList } from "lucide-react";
import { useLancamentosPendentes } from "@/hooks/useLancamentos";
import { NovoLancamentoTab } from "@/components/lancamentos/NovoLancamentoTab";
import { PendentesTab } from "@/components/lancamentos/PendentesTab";
import { FaturasTab } from "@/components/lancamentos/FaturasTab";
import { ConferenciaTab } from "@/components/lancamentos/ConferenciaTab";
import type { ItemOS } from "@/hooks/useConferenciaProducao";

const Lancamentos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "novo";
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const { lancamentos: lancamentosPendentes } = useLancamentosPendentes();

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (activeTab !== "novo") newParams.set("tab", activeTab);
    else newParams.delete("tab");
    setSearchParams(newParams, { replace: true });
  }, [activeTab]);

  useEffect(() => {
    if (tabFromUrl && ["novo", "pendentes", "faturas", "conferencia"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, []);

  const handleUsarParaLancamento = (clienteId: string, itens: ItemOS[]) => {
    // Switch to novo tab - the NovoLancamentoTab handles its own state
    setActiveTab("novo");
  };

  return (
    <AppLayout title="Lançamentos" subtitle="Registre a produção diária e gerencie o faturamento">
      <div className="content-panel">
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
              <TabsTrigger value="novo" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1">
                <FileText className="w-4 h-4" />Novo Lançamento
              </TabsTrigger>
              <TabsTrigger value="pendentes" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1">
                <Package className="w-4 h-4" />Pendentes
                {lancamentosPendentes.length > 0 && (
                  <span className="ml-1 bg-warning text-warning-foreground text-xs px-2 py-0.5 rounded-full">{lancamentosPendentes.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="faturas" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1">
                <Receipt className="w-4 h-4" />Faturas Geradas
              </TabsTrigger>
              <TabsTrigger value="conferencia" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1">
                <ClipboardList className="w-4 h-4" />Conferência
              </TabsTrigger>
            </TabsList>

            <TabsContent value="novo" className="mt-4">
              <NovoLancamentoTab onNavigateTab={setActiveTab} />
            </TabsContent>

            <TabsContent value="pendentes" className="mt-4">
              <PendentesTab />
            </TabsContent>

            <TabsContent value="faturas" className="mt-4">
              <FaturasTab />
            </TabsContent>

            <TabsContent value="conferencia" className="mt-4">
              <ConferenciaTab onUsarParaLancamento={handleUsarParaLancamento} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default Lancamentos;
