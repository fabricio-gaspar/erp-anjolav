import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Shield, FileText, Tag, Receipt, Database, Wrench,
  Settings as SettingsIcon, MessageSquare, Building2, FolderTree,
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
import { ConfiguracoesCategorias } from "@/components/configuracoes/ConfiguracoesCategorias";
import { ConfiguracoesCentrosCusto } from "@/components/configuracoes/ConfiguracoesCentrosCusto";

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
      <div className="w-full space-y-8">
        {/* Visual Content Header mirroring high-fidelity layout */}
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.6)] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500/90">SISTEMA E PARÂMETROS</span>
          </div>
          <h1 className="text-5xl font-black tracking-tightest text-slate-900 leading-[0.95] uppercase">
            Configurações
          </h1>
          <p className="text-[14px] text-slate-400 font-bold uppercase tracking-wider">
            Gestão global de processos e identidade do ERP
          </p>
        </div>

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
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
