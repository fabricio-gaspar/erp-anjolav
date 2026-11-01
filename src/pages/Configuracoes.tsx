import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Shield, FileText, Tag, Receipt, Database, Wrench,
  Settings as SettingsIcon, MessageSquare, Building2, FolderTree, Gift, LockKeyhole,
  Gauge,
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
import { ConfiguracoesFidelidade } from "@/components/configuracoes/ConfiguracoesFidelidade";
import { ConfiguracoesSeguranca } from "@/components/configuracoes/ConfiguracoesSeguranca";
import { ConfiguracoesCapacidadePdv } from "@/components/configuracoes/ConfiguracoesCapacidadePdv";

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
    <AppLayout title="Central de Configuração" subtitle="Controle completo da empresa ativa">
      <div className="page-shell">
        <PageHeader
          eyebrow="Sistema e parâmetros"
          title="Central de Configuração"
          description="Configure empresa, usuários, acessos, operação, fiscal, integrações e segurança em um único painel."
        />

        <div className="content-panel">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="page-tabs-list">
              <TabsTrigger
                value="equipe"
                aria-label="Equipe"
                className="page-tab-trigger gap-2"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Equipe</span>
              </TabsTrigger>
              <TabsTrigger
                value="permissoes"
                aria-label="Permissões"
                className="page-tab-trigger gap-2"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Permissões</span>
              </TabsTrigger>
              <TabsTrigger
                value="seguranca"
                aria-label="Segurança"
                className="page-tab-trigger gap-2"
              >
                <LockKeyhole className="w-4 h-4" />
                <span className="hidden sm:inline">Segurança</span>
              </TabsTrigger>
              <TabsTrigger
                value="rol"
                aria-label="ROL"
                className="page-tab-trigger gap-2"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">ROL</span>
              </TabsTrigger>
              <TabsTrigger
                value="capacidade"
                aria-label="Capacidade do PDV"
                className="page-tab-trigger gap-2"
              >
                <Gauge className="w-4 h-4" />
                <span className="hidden sm:inline">Capacidade</span>
              </TabsTrigger>
              <TabsTrigger value="fidelidade" aria-label="Fidelidade" className="page-tab-trigger gap-2">
                <Gift className="w-4 h-4" />
                <span className="hidden sm:inline">Fidelidade</span>
              </TabsTrigger>
              <TabsTrigger
                value="categorias"
                aria-label="Categorias financeiras"
                className="page-tab-trigger gap-2"
              >
                <FolderTree className="w-4 h-4" />
                <span className="hidden sm:inline">Categorias</span>
              </TabsTrigger>
              <TabsTrigger
                value="centros-custo"
                aria-label="Centros de custo"
                className="page-tab-trigger gap-2"
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Centros de custo</span>
              </TabsTrigger>
              <TabsTrigger
                value="etiquetas"
                aria-label="Etiquetas"
                className="page-tab-trigger gap-2"
              >
                <Tag className="w-4 h-4" />
                <span className="hidden sm:inline">Etiquetas</span>
              </TabsTrigger>
              <TabsTrigger
                value="fiscal"
                aria-label="Fiscal"
                className="page-tab-trigger gap-2"
              >
                <Receipt className="w-4 h-4" />
                <span className="hidden sm:inline">Fiscal</span>
              </TabsTrigger>
              <TabsTrigger
                value="dados"
                aria-label="Dados"
                className="page-tab-trigger gap-2"
              >
                <Database className="w-4 h-4" />
                <span className="hidden sm:inline">Dados</span>
              </TabsTrigger>
              <TabsTrigger
                value="sistema"
                aria-label="Sistema"
                className="page-tab-trigger gap-2"
              >
                <Wrench className="w-4 h-4" />
                <span className="hidden sm:inline">Sistema</span>
              </TabsTrigger>
              <TabsTrigger
                value="geral"
                aria-label="Geral"
                className="page-tab-trigger gap-2"
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Geral</span>
              </TabsTrigger>
              <TabsTrigger
                value="whatsapp"
                aria-label="WhatsApp"
                className="page-tab-trigger gap-2"
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

          <TabsContent value="seguranca" className="mt-4">
            <ConfiguracoesSeguranca />
          </TabsContent>

          <TabsContent value="rol" className="mt-4">
            <ConfiguracoesROL />
          </TabsContent>

          <TabsContent value="capacidade" className="mt-4">
            <ConfiguracoesCapacidadePdv />
          </TabsContent>

          <TabsContent value="fidelidade" className="mt-4">
            <ConfiguracoesFidelidade />
          </TabsContent>

          <TabsContent value="categorias" className="mt-4">
            <ConfiguracoesCategorias />
          </TabsContent>

          <TabsContent value="centros-custo" className="mt-4">
            <ConfiguracoesCentrosCusto />
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
