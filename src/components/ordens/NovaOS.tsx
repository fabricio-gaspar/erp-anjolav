import { useState } from "react";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useClientes } from "@/hooks/useClientes";
import { useFilteredClientes } from "@/hooks/useFilteredClientes";
import { useMotoristas } from "@/hooks/useMotoristas";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useHistoricoProducao } from "@/hooks/useHistoricoProducao";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

interface NovaOSProps {
  onSuccess?: () => void;
}

export function NovaOS({ onSuccess }: NovaOSProps) {
  const { activeArea } = useWorkspace();
  const [clienteId, setClienteId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [dataRetirada, setDataRetirada] = useState<Date>(new Date());
  const [prioridade, setPrioridade] = useState<"baixa" | "normal" | "alta" | "urgente">("normal");
  const [observacoes, setObservacoes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isLoading: isLoadingClientesOriginal } = useClientes();
  const { data: clientes = [], isLoading: isLoadingClientesFiltered } = useFilteredClientes();
  const { motoristasAtivos, isLoading: isLoadingMotoristas } = useMotoristas();
  const { veiculosAtivos, isLoading: isLoadingVeiculos } = useVeiculos();
  const { createOrdemServico } = useOrdensServico();
  const { registrarMudancaEtapa } = useHistoricoProducao(null);

  const clientesAtivos = clientes.filter(c => c.ativo);

  const handleSubmit = async () => {
    if (!clienteId) {
      toast.error("Selecione um cliente");
      return;
    }

    setIsSubmitting(true);

    try {
      const novaOS = await createOrdemServico.mutateAsync({
        cliente_id: clienteId,
        motorista_id: motoristaId || null,
        veiculo_id: veiculoId || null,
        data_retirada: format(dataRetirada, "yyyy-MM-dd"),
        prioridade,
        observacoes: observacoes || null,
        status: "retirada",
        data_previsao_entrega: null,
        data_entrega: null,
        valor_total: 0,
        valor_desconto: 0,
        forma_pagamento: null,
        status_pagamento: "pendente",
        pago_na_entrada: false,
        valor_pago: 0,
        urgente: prioridade === "urgente",
        percentual_urgencia: 0,
        origem: activeArea,
      });

      // Registrar no histórico de produção
      await registrarMudancaEtapa.mutateAsync({
        ordem_servico_id: novaOS.id,
        etapa_nova: "retirada",
        observacoes: "OS criada - Material retirado do cliente",
        dados_formulario: {
          data_retirada: format(dataRetirada, "yyyy-MM-dd"),
          motorista_id: motoristaId || null,
          veiculo_id: veiculoId || null,
        },
      });

      // Limpar formulário
      setClienteId("");
      setMotoristaId("");
      setVeiculoId("");
      setDataRetirada(new Date());
      setPrioridade("normal");
      setObservacoes("");

      onSuccess?.();
    } catch (error) {
      console.error("Erro ao criar OS:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = clienteId !== "";
  const isLoading = isLoadingClientesOriginal || isLoadingClientesFiltered || isLoadingMotoristas || isLoadingVeiculos;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Retirada - Nova OS</h3>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando dados...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6">
            {/* Cliente */}
            <div className="space-y-2">
              <Label className="text-primary">
                <span className="text-destructive">*</span> Cliente
              </Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientesAtivos.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhum cliente cadastrado
                    </SelectItem>
                  ) : (
                    clientesAtivos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.razao_social}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-primary">Vinculado ao cadastro de clientes.</p>
            </div>

            {/* Data da Retirada */}
            <div className="space-y-2">
              <Label>Data da Retirada</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataRetirada && "text-muted-foreground"
                    )}
                  >
                    {dataRetirada ? (
                      format(dataRetirada, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione a data</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataRetirada}
                    onSelect={(date) => date && setDataRetirada(date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Motorista */}
            <div className="space-y-2">
              <Label>Motorista</Label>
              <Select value={motoristaId} onValueChange={setMotoristaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motorista" />
                </SelectTrigger>
                <SelectContent>
                  {motoristasAtivos.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhum motorista disponível
                    </SelectItem>
                  ) : (
                    motoristasAtivos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {motoristasAtivos.length === 0 && (
                <p className="text-xs text-warning">
                  Nenhum motorista encontrado. Cadastre em "Motoristas".
                </p>
              )}
            </div>

            {/* Veículo */}
            <div className="space-y-2">
              <Label>Veículo</Label>
              <Select value={veiculoId} onValueChange={setVeiculoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {veiculosAtivos.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhum veículo disponível
                    </SelectItem>
                  ) : (
                    veiculosAtivos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.placa} - {v.modelo}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="space-y-2 col-span-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações gerais sobre a retirada..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t">
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando OS...
                </>
              ) : (
                "Criar OS e Iniciar Fluxo"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
