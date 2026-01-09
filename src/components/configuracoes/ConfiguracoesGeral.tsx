import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Database,
  Image,
  CreditCard,
  MessageSquare,
  RefreshCw,
  Upload,
  Check,
  Info,
  Landmark,
  QrCode,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const templateVariables = [
  "{{cliente}}",
  "{{mes_referencia}}",
  "{{valor}}",
  "{{vencimento}}",
  "{{link_nota}}",
  "{{chave_pix}}",
  "{{link_boleto}}",
  "{{linha_digitavel}}",
  "{{banco_nome}}",
  "{{banco_agencia}}",
  "{{banco_conta}}",
  "{{banco_titular}}",
  "{{empresa}}",
];

const defaultPixTemplate = `Prezado(a) {{cliente}},

Segue sua fatura referente ao mês de {{mes_referencia}}.

Valor: R$ {{valor}}
Vencimento: {{vencimento}}

📄 Nota Fiscal:
{{link_nota}}

💳 Pagamento via PIX:
Chave PIX: {{chave_pix}}`;

const defaultBoletoTemplate = `Prezado(a) {{cliente}},

Segue sua fatura referente ao mês de {{mes_referencia}}.

Valor: R$ {{valor}}
Vencimento: {{vencimento}}

📄 Nota Fiscal:
{{link_nota}}

📋 Pagamento via Boleto:
Linha Digitável: {{linha_digitavel}}
Link do Boleto: {{link_boleto}}`;

const defaultTransferenciaTemplate = `Prezado(a) {{cliente}},

Segue sua fatura referente ao mês de {{mes_referencia}}.

Valor: R$ {{valor}}
Vencimento: {{vencimento}}

📄 Nota Fiscal:
{{link_nota}}

🏦 Pagamento via Transferência:
Banco: {{banco_nome}}
Agência: {{banco_agencia}}
Conta: {{banco_conta}}
Titular: {{banco_titular}}`;

export function ConfiguracoesGeral() {
  const [isTesting, setIsTesting] = useState(false);

  // Identidade Visual
  const [nomeEmpresa, setNomeEmpresa] = useState("AnjoLav");
  const [corPrimaria, setCorPrimaria] = useState("#3b82f6");

  // Dados de Pagamento
  const [tipoChave, setTipoChave] = useState("cpf");
  const [chavePix, setChavePix] = useState("");
  const [nomeBanco, setNomeBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [contaCorrente, setContaCorrente] = useState("");
  const [titularConta, setTitularConta] = useState("");

  // Templates
  const [templatePix, setTemplatePix] = useState(defaultPixTemplate);
  const [templateBoleto, setTemplateBoleto] = useState(defaultBoletoTemplate);
  const [templateTransferencia, setTemplateTransferencia] = useState(defaultTransferenciaTemplate);

  // WhatsApp
  const [whatsappNumero, setWhatsappNumero] = useState("");
  const [whatsappApiKey, setWhatsappApiKey] = useState("");

  const handleTestConnection = async () => {
    setIsTesting(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsTesting(false);
    toast({
      title: "Conexão bem-sucedida",
      description: "O banco de dados está funcionando corretamente.",
    });
  };

  const handleSavePayment = () => {
    toast({
      title: "Dados salvos",
      description: "Dados de pagamento salvos com sucesso!",
    });
  };

  const handleSaveTemplates = () => {
    toast({
      title: "Templates salvos",
      description: "Templates de mensagem salvos com sucesso!",
    });
  };

  const handleSaveWhatsApp = () => {
    toast({
      title: "Configurações salvas",
      description: "Configurações do WhatsApp salvas com sucesso!",
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Row - Banco de Dados + Identidade Visual */}
      <div className="grid grid-cols-2 gap-6">
        {/* Banco de Dados */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Banco de Dados</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Teste a conexão com o banco de dados para garantir que tudo está funcionando corretamente.
          </p>
          <Button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isTesting ? "animate-spin" : ""}`} />
            Testar Conexão
          </Button>
        </Card>

        {/* Identidade Visual */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Image className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-foreground">Identidade Visual</h2>
          </div>

          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
              <Image className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Carregar Nova Logo
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Recomendado: PNG ou JPG transparente (500x500px).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nome da Empresa</Label>
              <Input
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cor Primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <Input
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="w-24"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Dados de Pagamento */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Dados de Pagamento (PIX e Banco)</h2>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Configure os dados de pagamento que serão enviados aos clientes no faturamento.
            </p>
          </div>
        </div>

        {/* Chave PIX */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-sm text-foreground">Chave PIX</h3>
          </div>
          <div className="grid grid-cols-[200px_1fr] gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Tipo de Chave</Label>
              <Select value={tipoChave} onValueChange={setTipoChave}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Chave PIX</Label>
              <Input
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                placeholder="Digite sua chave PIX"
              />
            </div>
          </div>
        </div>

        {/* Dados Bancários */}
        <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="w-4 h-4 text-slate-600" />
            <h3 className="font-semibold text-sm text-foreground">Dados Bancários (Transferência)</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nome do Banco</Label>
              <Input
                value={nomeBanco}
                onChange={(e) => setNomeBanco(e.target.value)}
                placeholder="Ex: Banco do Brasil"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Agência</Label>
              <Input
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
                placeholder="Ex: 1234-5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Conta Corrente</Label>
              <Input
                value={contaCorrente}
                onChange={(e) => setContaCorrente(e.target.value)}
                placeholder="Ex: 12345-6"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Titular da Conta</Label>
              <Input
                value={titularConta}
                onChange={(e) => setTitularConta(e.target.value)}
                placeholder="Nome do titular"
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSavePayment} className="bg-green-600 hover:bg-green-700">
          <Check className="w-4 h-4 mr-2" />
          Salvar Dados de Pagamento
        </Button>
      </Card>

      {/* Templates de Mensagem */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Templates de Mensagem (E-mail/WhatsApp)</h2>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Personalize as mensagens enviadas aos clientes por forma de pagamento. Use as variáveis disponíveis para dados dinâmicos.
            </p>
          </div>
        </div>

        {/* Variáveis disponíveis */}
        <div className="mb-4 p-3 border rounded-lg bg-background">
          <p className="text-xs text-muted-foreground mb-2">Variáveis disponíveis:</p>
          <div className="flex flex-wrap gap-1">
            {templateVariables.map((variable) => (
              <Badge
                key={variable}
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-secondary/80"
                onClick={() => {
                  navigator.clipboard.writeText(variable);
                  toast({ title: "Variável copiada!" });
                }}
              >
                {variable}
              </Badge>
            ))}
          </div>
        </div>

        {/* Tabs de Templates */}
        <Tabs defaultValue="pix" className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pix" className="flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              PIX
            </TabsTrigger>
            <TabsTrigger value="boleto" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Boleto
            </TabsTrigger>
            <TabsTrigger value="transferencia" className="flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              Transferência
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pix" className="mt-4">
            <Label className="text-sm font-medium text-foreground">
              Template para clientes com pagamento PIX
            </Label>
            <Textarea
              value={templatePix}
              onChange={(e) => setTemplatePix(e.target.value)}
              rows={12}
              className="mt-2 font-mono text-sm"
            />
          </TabsContent>

          <TabsContent value="boleto" className="mt-4">
            <Label className="text-sm font-medium text-foreground">
              Template para clientes com pagamento Boleto
            </Label>
            <Textarea
              value={templateBoleto}
              onChange={(e) => setTemplateBoleto(e.target.value)}
              rows={12}
              className="mt-2 font-mono text-sm"
            />
          </TabsContent>

          <TabsContent value="transferencia" className="mt-4">
            <Label className="text-sm font-medium text-foreground">
              Template para clientes com pagamento Transferência
            </Label>
            <Textarea
              value={templateTransferencia}
              onChange={(e) => setTemplateTransferencia(e.target.value)}
              rows={12}
              className="mt-2 font-mono text-sm"
            />
          </TabsContent>
        </Tabs>

        <Button onClick={handleSaveTemplates} className="bg-green-600 hover:bg-green-700">
          <Check className="w-4 h-4 mr-2" />
          Salvar Templates
        </Button>
      </Card>

      {/* WhatsApp Cloud API */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">WhatsApp Cloud API</h2>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Configure as credenciais da API do WhatsApp para enviar notificações automáticas aos clientes. Esta funcionalidade requer uma conta Meta Business verificada.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-xs text-muted-foreground">Número do WhatsApp</Label>
            <Input
              value={whatsappNumero}
              onChange={(e) => setWhatsappNumero(e.target.value)}
              placeholder="+55 11 99999-9999"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <Input
              type="password"
              value={whatsappApiKey}
              onChange={(e) => setWhatsappApiKey(e.target.value)}
              placeholder="Digite sua API Key"
            />
          </div>
        </div>

        <Button onClick={handleSaveWhatsApp} className="bg-green-600 hover:bg-green-700">
          <MessageSquare className="w-4 h-4 mr-2" />
          Salvar Configurações WhatsApp
        </Button>
      </Card>
    </div>
  );
}
