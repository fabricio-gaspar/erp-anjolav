import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Home, Check, Loader2 } from "lucide-react";
import { useClientes, useClienteById } from "@/hooks/useClientes";

interface ClienteDadosBasicosProps {
  clienteId: string | null;
  onNext: () => void;
  onClienteSaved: (clienteId: string) => void;
}

type TipoPessoa = "cnpj" | "cpf";
type Classificacao = "residencial" | "industrial";
type RegimeTributario = "simples_nacional" | "simples_excesso" | "normal" | "mei" | "nao_contribuinte";

export const ClienteDadosBasicos = ({ clienteId, onNext, onClienteSaved }: ClienteDadosBasicosProps) => {
  const { createCliente, updateCliente } = useClientes();
  const { data: clienteExistente, isLoading: isLoadingCliente } = useClienteById(clienteId);

  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("cnpj");
  const [classificacao, setClassificacao] = useState<Classificacao>("industrial");
  const [regimeTributario, setRegimeTributario] = useState<RegimeTributario>("nao_contribuinte");

  const [formData, setFormData] = useState({
    cpf_cnpj: "",
    razao_social: "",
    email: "",
    telefone: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    telefone2: "",
    contato: "",
    observacoes: "",
  });

  // Carregar dados do cliente existente
  useEffect(() => {
    if (clienteExistente) {
      setTipoPessoa(clienteExistente.tipo_pessoa as TipoPessoa);
      setClassificacao(clienteExistente.classificacao as Classificacao);
      setRegimeTributario((clienteExistente.regime_tributario as RegimeTributario) || "nao_contribuinte");
      setFormData({
        cpf_cnpj: clienteExistente.cpf_cnpj || "",
        razao_social: clienteExistente.razao_social || "",
        email: clienteExistente.email || "",
        telefone: clienteExistente.telefone || "",
        inscricao_estadual: clienteExistente.inscricao_estadual || "",
        inscricao_municipal: clienteExistente.inscricao_municipal || "",
        telefone2: clienteExistente.telefone2 || "",
        contato: clienteExistente.contato || "",
        observacoes: clienteExistente.observacoes || "",
      });
    }
  }, [clienteExistente]);

  // Reset form when creating new client
  useEffect(() => {
    if (!clienteId) {
      setTipoPessoa("cnpj");
      setClassificacao("industrial");
      setRegimeTributario("nao_contribuinte");
      setFormData({
        cpf_cnpj: "",
        razao_social: "",
        email: "",
        telefone: "",
        inscricao_estadual: "",
        inscricao_municipal: "",
        telefone2: "",
        contato: "",
        observacoes: "",
      });
    }
  }, [clienteId]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (goNext: boolean = false) => {
    if (!formData.razao_social.trim()) {
      return;
    }

    const clienteData = {
      tipo_pessoa: tipoPessoa,
      classificacao: classificacao,
      regime_tributario: regimeTributario,
      cpf_cnpj: formData.cpf_cnpj || null,
      razao_social: formData.razao_social,
      email: formData.email || null,
      telefone: formData.telefone || null,
      telefone2: formData.telefone2 || null,
      contato: formData.contato || null,
      inscricao_estadual: formData.inscricao_estadual || null,
      inscricao_municipal: formData.inscricao_municipal || null,
      observacoes: formData.observacoes || null,
      ativo: true,
      nome_fantasia: null,
    };

    if (clienteId) {
      updateCliente.mutate(
        { id: clienteId, ...clienteData },
        {
          onSuccess: () => {
            if (goNext) onNext();
          },
        }
      );
    } else {
      createCliente.mutate(clienteData, {
        onSuccess: (data) => {
          onClienteSaved(data.id);
          if (goNext) onNext();
        },
      });
    }
  };

  const isSaving = createCliente.isPending || updateCliente.isPending;

  if (isLoadingCliente && clienteId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando dados do cliente...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Tipo Pessoa */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Tipo Pessoa</label>
        <div className="flex gap-0">
          <Button
            type="button"
            variant={tipoPessoa === "cnpj" ? "default" : "outline"}
            className={`rounded-r-none ${tipoPessoa === "cnpj" ? "" : "border-r-0"}`}
            onClick={() => setTipoPessoa("cnpj")}
          >
            CNPJ
          </Button>
          <Button
            type="button"
            variant={tipoPessoa === "cpf" ? "default" : "outline"}
            className="rounded-l-none"
            onClick={() => setTipoPessoa("cpf")}
          >
            CPF
          </Button>
        </div>
      </div>

      {/* Classificação */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Classificação</label>
        <div className="flex gap-0">
          <Button
            type="button"
            variant={classificacao === "residencial" ? "default" : "outline"}
            className={`rounded-r-none gap-2 ${classificacao === "residencial" ? "" : "border-r-0"}`}
            onClick={() => setClassificacao("residencial")}
          >
            <Home className="w-4 h-4" />
            Residencial (ID2)
          </Button>
          <Button
            type="button"
            variant={classificacao === "industrial" ? "default" : "outline"}
            className="rounded-l-none gap-2"
            onClick={() => setClassificacao("industrial")}
          >
            <Building2 className="w-4 h-4" />
            Industrial (ID1)
          </Button>
        </div>
      </div>

      {/* Row 1: CNPJ + Razão Social */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Input
            placeholder={tipoPessoa === "cnpj" ? "* Número do CNPJ" : "* Número do CPF"}
            value={formData.cpf_cnpj}
            onChange={(e) => handleChange("cpf_cnpj", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Input
            placeholder="* RAZÃO SOCIAL"
            value={formData.razao_social}
            onChange={(e) => handleChange("razao_social", e.target.value)}
          />
        </div>
      </div>

      {/* Row 2: Email + Telefone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Input
            placeholder="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Input
            placeholder="Telefone (99) 99999-9999"
            value={formData.telefone}
            onChange={(e) => handleChange("telefone", e.target.value)}
          />
        </div>
      </div>

      {/* Row 3: IE + IM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Input
            placeholder="INSCRIÇÃO ESTADUAL (IE OU ISENTO)"
            value={formData.inscricao_estadual}
            onChange={(e) => handleChange("inscricao_estadual", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Input
            placeholder="INSCRIÇÃO MUNICIPAL (IM)"
            value={formData.inscricao_municipal}
            onChange={(e) => handleChange("inscricao_municipal", e.target.value)}
          />
        </div>
      </div>

      {/* Regime Tributário */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Regime Tributário</label>
        <div className="flex flex-wrap gap-0">
          <Button
            type="button"
            variant={regimeTributario === "simples_nacional" ? "default" : "outline"}
            className="rounded-r-none border-r-0"
            size="sm"
            onClick={() => setRegimeTributario("simples_nacional")}
          >
            Simples Nacional
          </Button>
          <Button
            type="button"
            variant={regimeTributario === "simples_excesso" ? "default" : "outline"}
            className="rounded-none border-r-0"
            size="sm"
            onClick={() => setRegimeTributario("simples_excesso")}
          >
            Simples Nacional (Excesso)
          </Button>
          <Button
            type="button"
            variant={regimeTributario === "normal" ? "default" : "outline"}
            className="rounded-none border-r-0"
            size="sm"
            onClick={() => setRegimeTributario("normal")}
          >
            Regime Normal
          </Button>
          <Button
            type="button"
            variant={regimeTributario === "mei" ? "default" : "outline"}
            className="rounded-none border-r-0"
            size="sm"
            onClick={() => setRegimeTributario("mei")}
          >
            MEI
          </Button>
          <Button
            type="button"
            variant={regimeTributario === "nao_contribuinte" ? "default" : "outline"}
            className="rounded-l-none"
            size="sm"
            onClick={() => setRegimeTributario("nao_contribuinte")}
          >
            Não Contribuinte
          </Button>
        </div>
      </div>

      {/* Row 4: Telefone 2 + Contato */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Input
            placeholder="Telefone 2 (opcional)"
            value={formData.telefone2}
            onChange={(e) => handleChange("telefone2", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Input
            placeholder="CONTATO / RESPONSÁVEL"
            value={formData.contato}
            onChange={(e) => handleChange("contato", e.target.value)}
          />
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-1">
        <Textarea
          placeholder="Observações gerais do cliente..."
          rows={4}
          value={formData.observacoes}
          onChange={(e) => handleChange("observacoes", e.target.value)}
        />
      </div>

      {/* Footer Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button 
          variant="outline" 
          onClick={() => handleSave(true)}
          disabled={isSaving || !formData.razao_social.trim()}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Próximo: Endereço
        </Button>
        <Button 
          onClick={() => handleSave(false)} 
          className="gap-2"
          disabled={isSaving || !formData.razao_social.trim()}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {clienteId ? "Atualizar Cliente" : "Salvar Cliente"}
        </Button>
      </div>
    </div>
  );
};
