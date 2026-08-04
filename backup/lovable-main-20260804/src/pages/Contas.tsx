import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown } from "lucide-react";

// Import the content from existing pages as embedded components
import ContasReceberContent from "@/components/contas/ContasReceberContent";
import ContasPagarContent from "@/components/contas/ContasPagarContent";

const Contas = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "receber";

  const handleTabChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", value);
    setSearchParams(newParams, { replace: true });
  };

  return (
    <AppLayout title="Contas" subtitle="Gerencie suas receitas e despesas">
      <div className="space-y-4">
        <Tabs value={tabFromUrl} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="receber" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              A Receber
            </TabsTrigger>
            <TabsTrigger value="pagar" className="gap-2">
              <TrendingDown className="w-4 h-4" />
              A Pagar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receber">
            <ContasReceberContent />
          </TabsContent>

          <TabsContent value="pagar">
            <ContasPagarContent />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Contas;
