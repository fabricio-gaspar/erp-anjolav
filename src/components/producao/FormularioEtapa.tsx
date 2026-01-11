import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useHistoricoProducao } from "@/hooks/useHistoricoProducao";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useMotoristas } from "@/hooks/useMotoristas";
import { useVeiculos } from "@/hooks/useVeiculos";
import { toast } from "sonner";

interface FormularioEtapaProps {
  ordemServicoId: string;
  etapaAtual: string;
  proximaEtapa: string;
  onClose: () => void;
  onSuccess: () => void;
}

const etapaLabels: Record<string, string> = {
  separacao: "Separação",
  lavagem: "Lavagem",
  secagem: "Secagem",
  passadoria: "Passadoria",
  embalagem: "Embalagem",
  expedicao: "Expedição",
  entregue: "Entrega",
};

export function FormularioEtapa({
  ordemServicoId,
  etapaAtual,
  proximaEtapa,
  onClose,
  onSuccess,
}: FormularioEtapaProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");

  // Campos específicos por etapa
  const [quantidadePecas, setQuantidadePecas] = useState("");
  const [pesoTotalKg, setPesoTotalKg] = useState("");
  const [itensDanificados, setItensDanificados] = useState("");
  const [maquinaUtilizada, setMaquinaUtilizada] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [produtosUtilizados, setProdutosUtilizados] = useState("");
  const [tipoAcabamento, setTipoAcabamento] = useState("");
  const [tipoEmbalagem, setTipoEmbalagem] = useState("");
  const [quantidadeVolumes, setQuantidadeVolumes] = useState("");
  const [pesoFinalKg, setPesoFinalKg] = useState("");
  const [prontoParaEntrega, setProntoParaEntrega] = useState(false);
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");

  const { updateOrdemServico } = useOrdensServico();
  const { registrarMudancaEtapa } = useHistoricoProducao(ordemServicoId);
  const { data: funcionarios = [] } = useFuncionarios();
  const { motoristasAtivos } = useMotoristas();
  const { veiculosAtivos } = useVeiculos();

  const funcionariosAtivos = funcionarios.filter((f) => f.ativo);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Construir dados do formulário baseado na etapa
      let dadosFormulario: Record<string, unknown> = {};

      switch (proximaEtapa) {
        case "separacao":
          dadosFormulario = {
            quantidade_pecas: Number(quantidadePecas) || 0,
            peso_total_kg: Number(pesoTotalKg) || 0,
            itens_danificados: itensDanificados,
          };
          break;
        case "lavagem":
          dadosFormulario = {
            maquina_utilizada: maquinaUtilizada,
            temperatura: Number(temperatura) || 0,
            produtos_utilizados: produtosUtilizados,
          };
          break;
        case "secagem":
          dadosFormulario = {
            maquina_utilizada: maquinaUtilizada,
            temperatura: Number(temperatura) || 0,
          };
          break;
        case "passadoria":
          dadosFormulario = {
            tipo_acabamento: tipoAcabamento,
            quantidade_passada: Number(quantidadePecas) || 0,
          };
          break;
        case "embalagem":
          dadosFormulario = {
            tipo_embalagem: tipoEmbalagem,
            quantidade_volumes: Number(quantidadeVolumes) || 0,
            peso_final_kg: Number(pesoFinalKg) || 0,
            pronto_para_entrega: prontoParaEntrega,
          };
          break;
        case "expedicao":
          dadosFormulario = {
            pronto_para_entrega: true,
          };
          break;
        case "entregue":
          dadosFormulario = {
            motorista_id: motoristaId,
            veiculo_id: veiculoId,
            data_hora_entrega: new Date().toISOString(),
          };
          break;
      }

      // Atualizar status da OS
      await updateOrdemServico.mutateAsync({
        id: ordemServicoId,
        status: proximaEtapa as any,
        ...(proximaEtapa === "entregue" && {
          data_entrega: new Date().toISOString().split("T")[0],
        }),
      });

      // Registrar no histórico (o trigger também registra, mas com dados básicos)
      await registrarMudancaEtapa.mutateAsync({
        ordem_servico_id: ordemServicoId,
        etapa_anterior: etapaAtual,
        etapa_nova: proximaEtapa,
        funcionario_id: funcionarioId || undefined,
        observacoes,
        dados_formulario: dadosFormulario,
      });

      toast.success(`OS avançada para ${etapaLabels[proximaEtapa] || proximaEtapa}`);
      onSuccess();
    } catch (error) {
      console.error("Erro ao avançar etapa:", error);
      toast.error("Erro ao avançar etapa");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCamposEspecificos = () => {
    switch (proximaEtapa) {
      case "separacao":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade de Peças</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={quantidadePecas}
                  onChange={(e) => setQuantidadePecas(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Peso Total (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={pesoTotalKg}
                  onChange={(e) => setPesoTotalKg(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Itens Danificados</Label>
              <Textarea
                placeholder="Descreva itens com avarias..."
                value={itensDanificados}
                onChange={(e) => setItensDanificados(e.target.value)}
              />
            </div>
          </>
        );

      case "lavagem":
      case "secagem":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máquina Utilizada</Label>
                <Input
                  placeholder="Ex: Máquina 1"
                  value={maquinaUtilizada}
                  onChange={(e) => setMaquinaUtilizada(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Temperatura (°C)</Label>
                <Input
                  type="number"
                  placeholder="60"
                  value={temperatura}
                  onChange={(e) => setTemperatura(e.target.value)}
                />
              </div>
            </div>
            {proximaEtapa === "lavagem" && (
              <div className="space-y-2">
                <Label>Produtos Utilizados</Label>
                <Textarea
                  placeholder="Lista de produtos..."
                  value={produtosUtilizados}
                  onChange={(e) => setProdutosUtilizados(e.target.value)}
                />
              </div>
            )}
          </>
        );

      case "passadoria":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Acabamento</Label>
              <Select value={tipoAcabamento} onValueChange={setTipoAcabamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passado">Passado</SelectItem>
                  <SelectItem value="dobrado">Dobrado</SelectItem>
                  <SelectItem value="cabide">Em Cabide</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade Processada</Label>
              <Input
                type="number"
                placeholder="0"
                value={quantidadePecas}
                onChange={(e) => setQuantidadePecas(e.target.value)}
              />
            </div>
          </div>
        );

      case "embalagem":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Embalagem</Label>
                <Select value={tipoEmbalagem} onValueChange={setTipoEmbalagem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plastico">Plástico</SelectItem>
                    <SelectItem value="papel">Papel</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="saco">Saco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade de Volumes</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={quantidadeVolumes}
                  onChange={(e) => setQuantidadeVolumes(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Peso Final (kg)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="0.0"
                value={pesoFinalKg}
                onChange={(e) => setPesoFinalKg(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="prontoEntrega"
                checked={prontoParaEntrega}
                onCheckedChange={(checked) => setProntoParaEntrega(checked === true)}
              />
              <Label htmlFor="prontoEntrega" className="cursor-pointer">
                Material pronto para entrega
              </Label>
            </div>
          </>
        );

      case "entregue":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Motorista</Label>
              <Select value={motoristaId} onValueChange={setMotoristaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {motoristasAtivos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Veículo</Label>
              <Select value={veiculoId} onValueChange={setVeiculoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {veiculosAtivos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} - {v.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Avançar para {etapaLabels[proximaEtapa] || proximaEtapa}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Funcionário Responsável */}
          <div className="space-y-2">
            <Label>Funcionário Responsável</Label>
            <Select value={funcionarioId} onValueChange={setFuncionarioId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o funcionário" />
              </SelectTrigger>
              <SelectContent>
                {funcionariosAtivos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campos Específicos da Etapa */}
          {renderCamposEspecificos()}

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações gerais..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Confirmar Avanço"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
