import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Home, Check, Loader2, Search } from "lucide-react";
import { useClientes, useClienteById } from "@/hooks/useClientes";
import { buscarCnpj, BrasilApiCnpjResponse } from "@/services/apiServices";
import { toast } from "sonner";
import { useConfiguracaoAutomatica } from "@/hooks/useConfiguracaoAutomatica";
interface ClienteDadosBasicosProps {
  clienteId: string | null;
  onNext: () => void;
  onClienteSaved: (clienteId: string) => void;
  onCnpjDataLoaded?: (data: BrasilApiCnpjResponse) => void;
}

type TipoPessoa = "cnpj" | "cpf";
type Classificacao = "residencial" | "industrial";
type RegimeTributario = "simples_nacional" | "simples_excesso" | "normal" | "mei" | "nao_contribuinte";

export const ClienteDadosBasicos = ({ 
  clienteId, 
  onNext, 
  onClienteSaved,
  onCnpjDataLoaded 
}: ClienteDadosBasicosProps) => {
  const { createCliente, updateCliente } = useClientes();
  const { data: clienteExistente, isLoading: isLoadingCliente } = useClienteById(clienteId);
  const { criarConfiguracaoComAgendamentos } = useConfiguracaoAutomatica();

  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("cnpj");
  const [classificacao, setClassificacao] = useState<Classificacao>("industrial");
  const [regimeTributario, setRegimeTributario] = useState<RegimeTributario>("nao_contribuinte");
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);

  const [formData, setFormData] = useState({
    cpf_cnpj: "",
    razao_social: "",
    nome_fantasia: "",
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
        nome_fantasia: clienteExistente.nome_fantasia || "",
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
        nome_fantasia: "",
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

  // Buscar CNPJ automaticamente
  const handleCnpjSearch = useCallback(async () => {
    const cnpjLimpo = formData.cpf_cnpj.replace(/\D/g, "");
    if (cnpjLimpo.length !== 14) {
      toast.error("CNPJ deve conter 14 dígitos");
      return;
    }

    setIsSearchingCnpj(true);
    try {
      const data = await buscarCnpj(cnpjLimpo);
      
      if (!data) {
        toast.error("CNPJ não encontrado na base de dados");
        return;
      }

      if (data.situacao_cadastral !== "ATIVA") {
        toast.warning(`Atenção: Situação cadastral ${data.descricao_situacao_cadastral}`);
      }

      // Preencher formulário com dados do CNPJ
      setFormData((prev) => ({
        ...prev,
        razao_social: data.razao_social || prev.razao_social,
        nome_fantasia: data.nome_fantasia || "",
        email: data.email || prev.email,
        telefone: data.ddd_telefone_1 || prev.telefone,
        telefone2: data.ddd_telefone_2 || prev.telefone2,
      }));

      // Determinar regime tributário baseado nos dados
      if (data.opcao_pelo_mei) {
        setRegimeTributario("mei");
      } else if (data.opcao_pelo_simples) {
        setRegimeTributario("simples_nacional");
      } else {
        setRegimeTributario("normal");
      }

      // Notificar componente pai sobre dados do CNPJ (para preencher endereço)
      if (onCnpjDataLoaded) {
        onCnpjDataLoaded(data);
      }

      toast.success("Dados do CNPJ carregados com sucesso!");
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      toast.error("Erro ao buscar CNPJ. Tente novamente.");
    } finally {
      setIsSearchingCnpj(false);
    }
  }, [formData.cpf_cnpj, onCnpjDataLoaded]);

  const handleSave = async (goNext: boolean = false) => {
    if (!formData.razao_social.trim()) {
      toast.error(tipoPessoa === "cpf" ? "Nome do Cliente é obrigatório" : "Razão Social é obrigatória");
      return;
    }

    const clienteData = {
      tipo_pessoa: tipoPessoa,
      classificacao: classificacao,
      regime_tributario: regimeTributario,
      cpf_cnpj: formData.cpf_cnpj || null,
      razao_social: formData.razao_social,
      nome_fantasia: formData.nome_fantasia || null,
      email: formData.email || null,
      telefone: formData.telefone || null,
      telefone2: formData.telefone2 || null,
      contato: formData.contato || null,
      inscricao_estadual: formData.inscricao_estadual || null,
      inscricao_municipal: formData.inscricao_municipal || null,
      observacoes: formData.observacoes || null,
      ativo: true,
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
        onSuccess: async (data) => {
          onClienteSaved(data.id);
          
          // Criar configuração padrão e agendamentos automaticamente
          await criarConfiguracaoComAgendamentos(data.id, classificacao);
          
          if (goNext) onNext();
        },
      });
    }
  };

  const isSaving = createCliente.isPending || updateCliente.isPending;
  const canSearchCnpj = tipoPessoa === "cnpj" && formData.cpf_cnpj.replace(/\D/g, "").length === 14;

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

      {/* Row 1: CNPJ/CPF + Botão de Busca */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="flex gap-2">
            <Input
              placeholder={tipoPessoa === "cnpj" ? "* NÚMERO DO CNPJ" : "* NÚMERO DO CPF"}
              value={formData.cpf_cnpj}
              onChange={(e) => handleChange("cpf_cnpj", e.target.value)}
              className="flex-1"
            />
            {tipoPessoa === "cnpj" && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCnpjSearch}
                disabled={!canSearchCnpj || isSearchingCnpj}
                title="Buscar dados do CNPJ"
              >
                {isSearchingCnpj ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
          {tipoPessoa === "cnpj" && (
            <p className="text-xs text-muted-foreground">
              Digite o CNPJ e clique na lupa para buscar automaticamente
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Input
            placeholder={tipoPessoa === "cpf" ? "* NOME DO CLIENTE" : "* RAZÃO SOCIAL"}
            value={formData.razao_social}
            onChange={(e) => handleChange("razao_social", e.target.value)}
          />
        </div>
      </div>

      {/* Nome Fantasia + Email + Telefone */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Input placeholder="Nome Fantasia" value={formData.nome_fantasia} onChange={(e) => handleChange("nome_fantasia", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Input placeholder="Email" type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Input placeholder="Telefone (99) 99999-9999" value={formData.telefone} onChange={(e) => handleChange("telefone", e.target.value)} />
        </div>
      </div>

      {/* IE + IM + Telefone2 + Contato */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
