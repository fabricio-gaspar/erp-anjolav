import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Home, Check } from "lucide-react";

interface ClienteDadosBasicosProps {
  onNext: () => void;
  onSave: () => void;
}

type TipoPessoa = "cnpj" | "cpf";
type Classificacao = "residencial" | "industrial";
type RegimeTributario = "simples" | "simples_excesso" | "normal" | "mei" | "nao_contribuinte";

export const ClienteDadosBasicos = ({ onNext, onSave }: ClienteDadosBasicosProps) => {
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("cnpj");
  const [classificacao, setClassificacao] = useState<Classificacao>("residencial");
  const [regimeTributario, setRegimeTributario] = useState<RegimeTributario>("nao_contribuinte");

  const [formData, setFormData] = useState({
    cnpj: "",
    razaoSocial: "",
    email: "",
    telefone: "",
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
    telefone2: "",
    contato: "",
    observacoes: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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
            value={formData.cnpj}
            onChange={(e) => handleChange("cnpj", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Input
            placeholder="* RAZÃO SOCIAL"
            value={formData.razaoSocial}
            onChange={(e) => handleChange("razaoSocial", e.target.value)}
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
            value={formData.inscricaoEstadual}
            onChange={(e) => handleChange("inscricaoEstadual", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Input
            placeholder="INSCRIÇÃO MUNICIPAL (IM)"
            value={formData.inscricaoMunicipal}
            onChange={(e) => handleChange("inscricaoMunicipal", e.target.value)}
          />
        </div>
      </div>

      {/* Regime Tributário */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Regime Tributário</label>
        <div className="flex flex-wrap gap-0">
          <Button
            type="button"
            variant={regimeTributario === "simples" ? "default" : "outline"}
            className="rounded-r-none border-r-0"
            size="sm"
            onClick={() => setRegimeTributario("simples")}
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
        <Button variant="outline" onClick={onNext}>
          Próximo: Endereço
        </Button>
        <Button onClick={onSave} className="gap-2">
          <Check className="w-4 h-4" />
          Salvar Cliente
        </Button>
      </div>
    </div>
  );
};
