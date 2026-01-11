import { useState } from "react";
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
  Settings as SettingsIcon 
} from "lucide-react";
import { ConfiguracoesEquipe } from "@/components/configuracoes/ConfiguracoesEquipe";
import { ConfiguracoesPermissoes } from "@/components/configuracoes/ConfiguracoesPermissoes";
import { ConfiguracoesROL } from "@/components/configuracoes/ConfiguracoesROL";
import { ConfiguracoesEtiquetas } from "@/components/configuracoes/ConfiguracoesEtiquetas";
import { ConfiguracoesFiscal } from "@/components/configuracoes/ConfiguracoesFiscal";
import { ConfiguracoesDados } from "@/components/configuracoes/ConfiguracoesDados";
import { ConfiguracoesSistema } from "@/components/configuracoes/ConfiguracoesSistema";
import { ConfiguracoesGeral } from "@/components/configuracoes/ConfiguracoesGeral";

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState("equipe");

  return (
    <AppLayout title="Configurações" subtitle="Gerencie as configurações do sistema">
      <div className="space-y-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 gap-0">
            <TabsTrigger
              value="equipe"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 gap-2"
            >
              <Users className="w-4 h-4" />
              Equipe & Motoristas
            </TabsTrigger>
            <TabsTrigger
              value="permissoes"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 gap-2"
            >
              <Shield className="w-4 h-4" />
              Permissões
            </TabsTrigger>
            <TabsTrigger
              value="rol"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 gap-2"
            >
              <FileText className="w-4 h-4" />
              ROL
            </TabsTrigger>
            <TabsTrigger
              value="etiquetas"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 gap-2"
            >
              <Tag className="w-4 h-4" />
              Etiquetas
            </TabsTrigger>
            <TabsTrigger
              value="fiscal"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 gap-2"
            >
              <Receipt className="w-4 h-4" />
              Fiscal
            </TabsTrigger>
            <TabsTrigger
              value="dados"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 gap-2"
            >
              <Database className="w-4 h-4" />
              Dados
            </TabsTrigger>
            <TabsTrigger
              value="sistema"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 gap-2"
            >
              <Wrench className="w-4 h-4" />
              Sistema
            </TabsTrigger>
            <TabsTrigger
              value="geral"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 gap-2"
            >
              <SettingsIcon className="w-4 h-4" />
              Geral
            </TabsTrigger>
          </TabsList>

          <TabsContent value="equipe" className="mt-6">
            <ConfiguracoesEquipe />
          </TabsContent>

          <TabsContent value="permissoes" className="mt-6">
            <ConfiguracoesPermissoes />
          </TabsContent>

          <TabsContent value="rol" className="mt-6">
            <ConfiguracoesROL />
          </TabsContent>

          <TabsContent value="etiquetas" className="mt-6">
            <ConfiguracoesEtiquetas />
          </TabsContent>

          <TabsContent value="fiscal" className="mt-6">
            <ConfiguracoesFiscal />
          </TabsContent>

          <TabsContent value="dados" className="mt-6">
            <ConfiguracoesDados />
          </TabsContent>

          <TabsContent value="sistema" className="mt-6">
            <ConfiguracoesSistema />
          </TabsContent>

          <TabsContent value="geral" className="mt-6">
            <ConfiguracoesGeral />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
