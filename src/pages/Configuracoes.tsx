import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Shield, 
  FileText, 
  Tag, 
  Receipt, 
  Database, 
  Wrench, 
  Settings as SettingsIcon,
  MessageSquare 
} from "lucide-react";
import { ConfiguracoesEquipe } from "@/components/configuracoes/ConfiguracoesEquipe";
import { ConfiguracoesPermissoes } from "@/components/configuracoes/ConfiguracoesPermissoes";
import { ConfiguracoesROL } from "@/components/configuracoes/ConfiguracoesROL";
import { ConfiguracoesEtiquetas } from "@/components/configuracoes/ConfiguracoesEtiquetas";
import { ConfiguracoesFiscal } from "@/components/configuracoes/ConfiguracoesFiscal";
import { ConfiguracoesDados } from "@/components/configuracoes/ConfiguracoesDados";
import { ConfiguracoesSistema } from "@/components/configuracoes/ConfiguracoesSistema";
import { ConfiguracoesGeral } from "@/components/configuracoes/ConfiguracoesGeral";
import { ConfiguracoesWhatsApp } from "@/components/configuracoes/ConfiguracoesWhatsApp";

const Configuracoes = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "equipe");

  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  return (
    <AppLayout title="Configurações" subtitle="Gerencie as configurações do sistema">
      <div className="content-panel">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="justify-start bg-transparent border-b rounded-none h-auto p-0 gap-0 inline-flex min-w-max w-full sm:w-auto">
              <TabsTrigger
                value="equipe"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 gap-2"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Equipe</span>
              </TabsTrigger>
              <TabsTrigger
                value="permissoes"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 gap-2"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Permissões</span>
              </TabsTrigger>
              <TabsTrigger
                value="rol"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 gap-2"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">ROL</span>
              </TabsTrigger>
              <TabsTrigger
                value="etiquetas"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 gap-2"
              >
                <Tag className="w-4 h-4" />
                <span className="hidden sm:inline">Etiquetas</span>
              </TabsTrigger>
              <TabsTrigger
                value="fiscal"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 gap-2"
              >
                <Receipt className="w-4 h-4" />
                <span className="hidden sm:inline">Fiscal</span>
              </TabsTrigger>
              <TabsTrigger
                value="dados"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 gap-2"
              >
                <Database className="w-4 h-4" />
                <span className="hidden sm:inline">Dados</span>
              </TabsTrigger>
              <TabsTrigger
                value="sistema"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 gap-2"
              >
                <Wrench className="w-4 h-4" />
                <span className="hidden sm:inline">Sistema</span>
              </TabsTrigger>
              <TabsTrigger
                value="geral"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 gap-2"
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Geral</span>
              </TabsTrigger>
              <TabsTrigger
                value="whatsapp"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="equipe" className="mt-4">
            <ConfiguracoesEquipe />
          </TabsContent>

          <TabsContent value="permissoes" className="mt-4">
            <ConfiguracoesPermissoes />
          </TabsContent>

          <TabsContent value="rol" className="mt-4">
            <ConfiguracoesROL />
          </TabsContent>

          <TabsContent value="etiquetas" className="mt-4">
            <ConfiguracoesEtiquetas />
          </TabsContent>

          <TabsContent value="fiscal" className="mt-4">
            <ConfiguracoesFiscal />
          </TabsContent>

          <TabsContent value="dados" className="mt-4">
            <ConfiguracoesDados />
          </TabsContent>

          <TabsContent value="sistema" className="mt-4">
            <ConfiguracoesSistema />
          </TabsContent>

          <TabsContent value="geral" className="mt-4">
            <ConfiguracoesGeral />
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-4">
            <ConfiguracoesWhatsApp />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
