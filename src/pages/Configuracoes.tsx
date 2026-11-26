import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Shield, FileText, Tag, Receipt, Database, Wrench,
  Settings as SettingsIcon, MessageSquare, Building2, FolderTree, Gift, LockKeyhole,
  Gauge, Palette,
  MapPin, CreditCard, Bell, UserRound, Image as ImageIcon,
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
import { ConfiguracoesTemaPdv } from "@/components/configuracoes/ConfiguracoesTemaPdv";
import { ConfiguracoesPdvComerciais } from "@/components/configuracoes/ConfiguracoesPdvComerciais";
import { ConfiguracoesPosicoesPdv } from "@/components/configuracoes/ConfiguracoesPosicoesPdv";
import { ConfiguracoesFaturamento } from "@/components/configuracoes/ConfiguracoesFaturamento";

const sections = [
  { value: "empresa", title: "Empresa e acesso", description: "Identidade, endereço, usuários, acessos e segurança", icon: Building2, tabs: [
    { value: "geral", label: "Identidade da empresa", icon: ImageIcon },
    { value: "endereco", label: "Endereço", icon: MapPin },
    { value: "equipe", label: "Equipe e usuários", icon: Users },
    { value: "permissoes", label: "Acessos e permissões", icon: Shield },
    { value: "seguranca", label: "Segurança", icon: LockKeyhole },
  ] },
  { value: "operacao", title: "Operação do PDV", description: "Impressão, etiquetas, capacidade, preços e regras do atendimento", icon: SettingsIcon, tabs: [
    { value: "rol", label: "ROL", icon: FileText },
    { value: "capacidade", label: "Capacidade", icon: Gauge },
    { value: "etiquetas", label: "Etiquetas", icon: Tag },
    { value: "fidelidade", label: "Fidelidade", icon: Gift },
    { value: "visual-pdv", label: "Visual do PDV", icon: Palette },
    { value: "regras-pdv", label: "Regras comerciais", icon: Gauge },
    { value: "posicoes-pdv", label: "Posições do PDV", icon: MapPin },
  ] },
  { value: "financeiro", title: "Financeiro e fiscal", description: "Recebimentos, mensagens de cobrança, classificação e emissão fiscal", icon: Receipt, tabs: [
    { value: "pagamentos", label: "Dados de pagamento", icon: CreditCard },
    { value: "faturamento", label: "Faturamento", icon: Receipt },
    { value: "mensagens-cobranca", label: "Mensagens de cobrança", icon: MessageSquare },
    { value: "categorias", label: "Categorias", icon: FolderTree },
    { value: "centros-custo", label: "Centros de custo", icon: Building2 },
    { value: "fiscal", label: "Fiscal", icon: Receipt },
  ] },
  { value: "integracoes", title: "Integrações e sistema", description: "Canais de comunicação, portal do cliente, dados e diagnóstico técnico", icon: MessageSquare, tabs: [
    { value: "whatsapp", label: "WhatsApp · conexão", icon: MessageSquare },
    { value: "whatsapp-cloud", label: "WhatsApp Cloud API", icon: MessageSquare },
    { value: "notificacoes", label: "Notificações", icon: Bell },
    { value: "portal-cliente", label: "Portal do cliente", icon: UserRound },
    { value: "dados", label: "Backup e dados", icon: Database },
    { value: "sistema", label: "Sistema", icon: Wrench },
  ] },
] as const;

const validTabs = new Set<string>(sections.flatMap((section) => section.tabs.map((tab) => tab.value)));
const sectionForTab = (tab: string) => sections.find((section) => section.tabs.some((item) => item.value === tab));

const Configuracoes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const initialTab = tabFromUrl && validTabs.has(tabFromUrl) ? tabFromUrl : "geral";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeSection, setActiveSection] = useState(sectionForTab(initialTab)?.value ?? sections[0].value);

  useEffect(() => {
    if (tabFromUrl && validTabs.has(tabFromUrl)) {
      setActiveTab(tabFromUrl);
      setActiveSection(sectionForTab(tabFromUrl)?.value ?? sections[0].value);
    }
  }, [tabFromUrl]);

  const selectModule = (value: string) => {
    setActiveTab(value);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("tab", value);
      return next;
    }, { replace: true });
  };

  const selectSection = (value: string) => {
    const section = sections.find((item) => item.value === value) ?? sections[0];
    const nextTab = section.tabs.some((item) => item.value === activeTab) ? activeTab : section.tabs[0].value;
    setActiveSection(section.value);
    selectModule(nextTab);
  };

  const renderTabContent = (value: string) => {
    switch (value) {
      case "equipe": return <ConfiguracoesEquipe />;
      case "permissoes": return <ConfiguracoesPermissoes />;
      case "seguranca": return <ConfiguracoesSeguranca />;
      case "endereco": return <ConfiguracoesGeral section="endereco" />;
      case "pagamentos": return <ConfiguracoesGeral section="pagamentos" />;
      case "faturamento": return <ConfiguracoesFaturamento />;
      case "mensagens-cobranca": return <ConfiguracoesGeral section="mensagens-cobranca" />;
      case "rol": return <ConfiguracoesROL />;
      case "capacidade": return <ConfiguracoesCapacidadePdv />;
      case "fidelidade": return <ConfiguracoesFidelidade />;
      case "visual-pdv": return <ConfiguracoesTemaPdv />;
      case "regras-pdv": return <ConfiguracoesPdvComerciais />;
      case "posicoes-pdv": return <ConfiguracoesPosicoesPdv />;
      case "categorias": return <ConfiguracoesCategorias />;
      case "centros-custo": return <ConfiguracoesCentrosCusto />;
      case "etiquetas": return <ConfiguracoesEtiquetas />;
      case "fiscal": return <ConfiguracoesFiscal />;
      case "dados": return <ConfiguracoesDados />;
      case "sistema": return <ConfiguracoesSistema />;
      case "whatsapp": return <ConfiguracoesWhatsApp />;
      case "whatsapp-cloud": return <ConfiguracoesGeral section="whatsapp-cloud" />;
      case "notificacoes": return <ConfiguracoesGeral section="notificacoes" />;
      case "portal-cliente": return <ConfiguracoesGeral section="portal-cliente" />;
      case "geral": return <ConfiguracoesGeral section="identidade" />;
      default: return null;
    }
  };

  return (
    <AppLayout title="Configurações" subtitle="Empresa, operação, financeiro e integrações">
      <div className="page-shell">
        <PageHeader
          eyebrow="Sistema e parâmetros"
          title="Configurações"
          description="Escolha uma área abaixo para configurar a empresa, os acessos e a operação."
        />

        <div className="content-panel">
          <Tabs value={activeSection} onValueChange={selectSection} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-2 xl:grid-cols-4">
              {sections.map(({ value, title, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="min-h-14 justify-start gap-3 rounded-xl border bg-card px-4 py-3 text-left data-[state=active]:border-primary data-[state=active]:bg-primary/10">
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-semibold">{title}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{sections.find((section) => section.value === value)?.tabs.length} módulos</span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {sections.map((section) => (
              <TabsContent key={section.value} value={section.value} className="mt-5">
                <div className="rounded-xl border bg-card p-4 sm:p-5">
                  <div className="mb-4 flex flex-col gap-1 border-b pb-4">
                    <h2 className="font-semibold text-foreground">{section.title}</h2>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                  <Tabs value={section.tabs.some((item) => item.value === activeTab) ? activeTab : section.tabs[0].value} onValueChange={selectModule} className="w-full">
                    <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-muted/40 p-2">
                      {section.tabs.map(({ value, label, icon: Icon }) => (
                        <TabsTrigger key={value} value={value} className="h-10 gap-2 rounded-md border bg-background px-3 data-[state=active]:border-primary data-[state=active]:bg-primary/10">
                          <Icon className="h-4 w-4" />{label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {section.tabs.map((tab) => (
                      <TabsContent key={tab.value} value={tab.value} className="mt-5">
                        {renderTabContent(tab.value)}
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
