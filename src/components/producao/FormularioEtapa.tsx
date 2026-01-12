import { useState } from "react";
import { Loader2, Info, CheckCircle, Plus, Trash2 } from "lucide-react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useHistoricoProducao } from "@/hooks/useHistoricoProducao";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useMotoristas } from "@/hooks/useMotoristas";
import { useVeiculos } from "@/hooks/useVeiculos";
import { usePrecosEspeciais } from "@/hooks/useProdutos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ItemSeparacao {
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

interface FormularioEtapaProps {
  ordemServicoId: string;
  etapaAtual: string;
  proximaEtapa: string;
  onClose: () => void;
  onSuccess: () => void;
}

const etapaLabels: Record<string, string> = {
  retirada: "Retirada",
  separacao: "Separação",
  lavagem: "Lavagem",
  secagem: "Secagem",
  passadoria: "Passadoria",
  embalagem: "Embalagem",
  expedicao: "Expedição",
  entregue: "Entrega",
};

const etapaDescricoes: Record<string, string> = {
  retirada: "Confirme o horário da retirada e o funcionário responsável.",
  separacao: "Registre a quantidade de peças recebidas e verifique se há itens danificados.",
  lavagem: "Selecione a máquina e configure os parâmetros de lavagem.",
  secagem: "Defina a máquina e temperatura para secagem.",
  passadoria: "Escolha o tipo de acabamento e registre a qualidade.",
  embalagem: "Prepare o pacote final para entrega ao cliente.",
  expedicao: "Confirme que a OS está pronta para retirada/entrega.",
  entregue: "Registre os dados da entrega ao cliente.",
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

  // Campos específicos por etapa - Separação
  const [itensSeparacao, setItensSeparacao] = useState<ItemSeparacao[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [quantidadeItem, setQuantidadeItem] = useState("");
  const [itensDanificados, setItensDanificados] = useState("");
  const [conferidoCliente, setConferidoCliente] = useState(false);
  
  // Campos legados (mantidos para outras etapas)
  const [quantidadePecas, setQuantidadePecas] = useState("");
  
  const [maquinaUtilizada, setMaquinaUtilizada] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [tipoLavagem, setTipoLavagem] = useState("");
  const [produtosUtilizados, setProdutosUtilizados] = useState("");
  const [tempoEstimado, setTempoEstimado] = useState("");

  const [tipoAcabamento, setTipoAcabamento] = useState("");
  const [observacoesQualidade, setObservacoesQualidade] = useState("");
  const [nivelQualidade, setNivelQualidade] = useState("");

  const [tipoEmbalagem, setTipoEmbalagem] = useState("");
  const [quantidadeVolumes, setQuantidadeVolumes] = useState("");
  const [pesoFinalKg, setPesoFinalKg] = useState("");
  const [etiquetaAplicada, setEtiquetaAplicada] = useState(false);
  const [conferenciaFinal, setConferenciaFinal] = useState(false);
  const [prontoParaEntrega, setProntoParaEntrega] = useState(false);

  const [localizacaoEstoque, setLocalizacaoEstoque] = useState("");
  const [observacoesEntrega, setObservacoesEntrega] = useState("");

  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [nomeRecebedor, setNomeRecebedor] = useState("");
  const [documentoRecebedor, setDocumentoRecebedor] = useState("");
  
  // Campos específicos da etapa Retirada
  const [horarioRetirada, setHorarioRetirada] = useState("");

  const { ordensServico, updateOrdemServico } = useOrdensServico();
  const { registrarMudancaEtapa } = useHistoricoProducao(ordemServicoId);
  const { data: funcionarios = [] } = useFuncionarios();
  const { motoristasAtivos } = useMotoristas();
  const { veiculosAtivos } = useVeiculos();

  const funcionariosAtivos = funcionarios.filter((f) => f.ativo);

  // Buscar dados da OS para obter o cliente_id
  const osAtual = ordensServico.find(os => os.id === ordemServicoId);
  const clienteId = osAtual?.cliente_id || null;

  // Buscar produtos do cliente (preços especiais)
  const { precos: precosEspeciais, isLoading: isLoadingPrecos } = usePrecosEspeciais(clienteId);

  // Funções para gerenciar itens da separação
  const handleAdicionarItem = () => {
    if (!produtoSelecionado || !quantidadeItem) {
      toast.error("Selecione um produto e informe a quantidade");
      return;
    }

    const precoItem = precosEspeciais.find((p: any) => p.produto_id === produtoSelecionado);
    if (!precoItem) return;

    const quantidade = Number(quantidadeItem);
    const preco = precoItem.preco_especial;

    setItensSeparacao(prev => [
      ...prev,
      {
        produto_id: produtoSelecionado,
        produto_nome: precoItem.produto?.nome || "Produto",
        quantidade,
        preco_unitario: preco,
        subtotal: quantidade * preco,
      }
    ]);

    setProdutoSelecionado("");
    setQuantidadeItem("");
  };

  const handleRemoverItem = (index: number) => {
    setItensSeparacao(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Construir dados do formulário baseado na etapa ATUAL
      let dadosFormulario: Record<string, unknown> = {};

      switch (etapaAtual) {
        case "retirada":
          dadosFormulario = {
            horario_retirada: horarioRetirada || new Date().toISOString(),
          };
          break;
        case "separacao":
          // Salvar itens na tabela itens_ordem_servico
          for (const item of itensSeparacao) {
            const { error } = await supabase.from("itens_ordem_servico").insert({
              ordem_servico_id: ordemServicoId,
              produto_id: item.produto_id,
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario,
              subtotal: item.subtotal,
            });
            if (error) throw error;
          }

          dadosFormulario = {
            quantidade_pecas: itensSeparacao.reduce((acc, i) => acc + i.quantidade, 0),
            itens_danificados: itensDanificados || null,
            conferido_cliente: conferidoCliente,
          };
          break;
        case "lavagem":
          dadosFormulario = {
            maquina_utilizada: maquinaUtilizada,
            temperatura: Number(temperatura) || 0,
            tipo_lavagem: tipoLavagem,
            produtos_utilizados: produtosUtilizados,
            tempo_estimado_min: Number(tempoEstimado) || 0,
          };
          break;
        case "secagem":
          dadosFormulario = {
            maquina_utilizada: maquinaUtilizada,
            temperatura: Number(temperatura) || 0,
            tempo_estimado_min: Number(tempoEstimado) || 0,
          };
          break;
        case "passadoria":
          dadosFormulario = {
            tipo_acabamento: tipoAcabamento,
            quantidade_passada: Number(quantidadePecas) || 0,
            nivel_qualidade: nivelQualidade,
            observacoes_qualidade: observacoesQualidade || null,
          };
          break;
        case "embalagem":
          dadosFormulario = {
            tipo_embalagem: tipoEmbalagem,
            quantidade_volumes: Number(quantidadeVolumes) || 0,
            peso_final_kg: Number(pesoFinalKg) || 0,
            etiqueta_aplicada: etiquetaAplicada,
            conferencia_final: conferenciaFinal,
            pronto_para_entrega: prontoParaEntrega,
          };
          break;
        case "expedicao":
          dadosFormulario = {
            localizacao_estoque: localizacaoEstoque,
            observacoes_entrega: observacoesEntrega || null,
            pronto_para_entrega: true,
          };
          break;
        case "entregue":
          dadosFormulario = {
            motorista_id: motoristaId || null,
            veiculo_id: veiculoId || null,
            nome_recebedor: nomeRecebedor || null,
            documento_recebedor: documentoRecebedor || null,
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

      // Registrar no histórico
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
    // Renderizar campos baseado na etapa ATUAL
    switch (etapaAtual) {
      case "retirada":
        return (
          <div className="space-y-2">
            <Label>Horário da Retirada *</Label>
            <Input
              type="datetime-local"
              value={horarioRetirada}
              onChange={(e) => setHorarioRetirada(e.target.value)}
            />
          </div>
        );

      case "separacao":
        return (
          <>
            {/* Seleção de Produto */}
            <div className="space-y-2">
              <Label>Produto do Cliente *</Label>
              <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingPrecos ? "Carregando..." : "Selecione um produto"} />
                </SelectTrigger>
                <SelectContent>
                  {precosEspeciais.map((preco: any) => (
                    <SelectItem key={preco.produto_id} value={preco.produto_id}>
                      {preco.produto?.nome} - R$ {preco.preco_especial.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {precosEspeciais.length === 0 && !isLoadingPrecos && (
                <p className="text-xs text-muted-foreground">
                  Nenhum produto cadastrado para este cliente. Configure a tabela de preços no cadastro do cliente.
                </p>
              )}
            </div>

            {/* Quantidade e Botão Adicionar */}
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2 space-y-2">
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={quantidadeItem}
                  onChange={(e) => setQuantidadeItem(e.target.value)}
                />
              </div>
              <Button 
                type="button" 
                onClick={handleAdicionarItem}
                disabled={!produtoSelecionado || !quantidadeItem}
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>

            {/* Lista de Itens Adicionados */}
            {itensSeparacao.length > 0 && (
              <div className="border rounded-md p-3 space-y-2">
                <Label className="text-sm font-medium">Itens Separados:</Label>
                {itensSeparacao.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm bg-muted/50 p-2 rounded">
                    <span className="truncate flex-1">{item.produto_nome} x {item.quantidade}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium whitespace-nowrap">R$ {item.subtotal.toFixed(2)}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleRemoverItem(index)}
                        className="h-7 w-7 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Total de Peças:</span>
                  <span>{itensSeparacao.reduce((acc, i) => acc + i.quantidade, 0)}</span>
                </div>
              </div>
            )}

            {/* Itens Danificados */}
            <div className="space-y-2">
              <Label>Itens Danificados / Avarias</Label>
              <Textarea
                placeholder="Descreva itens com avarias, manchas ou defeitos encontrados..."
                value={itensDanificados}
                onChange={(e) => setItensDanificados(e.target.value)}
                rows={2}
              />
            </div>

            {/* Checkbox Conferido */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
              <Checkbox
                id="conferidoCliente"
                checked={conferidoCliente}
                onCheckedChange={(checked) => setConferidoCliente(checked === true)}
              />
              <Label htmlFor="conferidoCliente" className="cursor-pointer text-sm">
                Conferido com cliente na retirada
              </Label>
            </div>
          </>
        );

      case "lavagem":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máquina Utilizada *</Label>
                <Select value={maquinaUtilizada} onValueChange={setMaquinaUtilizada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lavadora-01">Lavadora 01</SelectItem>
                    <SelectItem value="lavadora-02">Lavadora 02</SelectItem>
                    <SelectItem value="lavadora-03">Lavadora 03</SelectItem>
                    <SelectItem value="lavadora-industrial">Lavadora Industrial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Lavagem</Label>
                <Select value={tipoLavagem} onValueChange={setTipoLavagem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="delicada">Delicada</SelectItem>
                    <SelectItem value="pesada">Pesada</SelectItem>
                    <SelectItem value="especial">Especial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Temperatura (°C)</Label>
                <Select value={temperatura} onValueChange={setTemperatura}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Fria (30°C)</SelectItem>
                    <SelectItem value="40">Morna (40°C)</SelectItem>
                    <SelectItem value="60">Quente (60°C)</SelectItem>
                    <SelectItem value="90">Muito Quente (90°C)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tempo Estimado (min)</Label>
                <Input
                  type="number"
                  placeholder="45"
                  value={tempoEstimado}
                  onChange={(e) => setTempoEstimado(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Produtos Utilizados</Label>
              <Textarea
                placeholder="Ex: Sabão neutro, amaciante, alvejante..."
                value={produtosUtilizados}
                onChange={(e) => setProdutosUtilizados(e.target.value)}
                rows={2}
              />
            </div>
          </>
        );

      case "secagem":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máquina / Local *</Label>
                <Select value={maquinaUtilizada} onValueChange={setMaquinaUtilizada}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="secadora-01">Secadora 01</SelectItem>
                    <SelectItem value="secadora-02">Secadora 02</SelectItem>
                    <SelectItem value="secadora-industrial">Secadora Industrial</SelectItem>
                    <SelectItem value="varal">Varal</SelectItem>
                    <SelectItem value="cabideiro">Cabideiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Temperatura</Label>
                <Select value={temperatura} onValueChange={setTemperatura}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="40">Baixa (40°C)</SelectItem>
                    <SelectItem value="60">Média (60°C)</SelectItem>
                    <SelectItem value="80">Alta (80°C)</SelectItem>
                    <SelectItem value="0">Natural (varal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tempo Estimado (min)</Label>
              <Input
                type="number"
                placeholder="60"
                value={tempoEstimado}
                onChange={(e) => setTempoEstimado(e.target.value)}
              />
            </div>
          </>
        );

      case "passadoria":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Acabamento *</Label>
                <Select value={tipoAcabamento} onValueChange={setTipoAcabamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passado">Passado a ferro</SelectItem>
                    <SelectItem value="dobrado">Dobrado</SelectItem>
                    <SelectItem value="cabide">Em Cabide</SelectItem>
                    <SelectItem value="passado-dobrado">Passado e Dobrado</SelectItem>
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
            <div className="space-y-2">
              <Label>Nível de Qualidade</Label>
              <Select value={nivelQualidade} onValueChange={setNivelQualidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Avalie a qualidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ Excelente</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ Muito Bom</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ Bom</SelectItem>
                  <SelectItem value="2">⭐⭐ Regular</SelectItem>
                  <SelectItem value="1">⭐ Precisa Retrabalho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações de Qualidade</Label>
              <Textarea
                placeholder="Detalhes sobre qualidade, manchas restantes, etc..."
                value={observacoesQualidade}
                onChange={(e) => setObservacoesQualidade(e.target.value)}
                rows={2}
              />
            </div>
          </>
        );

      case "embalagem":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Embalagem *</Label>
                <Select value={tipoEmbalagem} onValueChange={setTipoEmbalagem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plastico">Plástico Transparente</SelectItem>
                    <SelectItem value="papel">Papel Kraft</SelectItem>
                    <SelectItem value="caixa">Caixa de Papelão</SelectItem>
                    <SelectItem value="saco">Saco TNT</SelectItem>
                    <SelectItem value="cabide-capa">Cabide com Capa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade de Volumes *</Label>
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
            <div className="space-y-3 p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="etiquetaAplicada"
                  checked={etiquetaAplicada}
                  onCheckedChange={(checked) => setEtiquetaAplicada(checked === true)}
                />
                <Label htmlFor="etiquetaAplicada" className="cursor-pointer text-sm">
                  Etiqueta de identificação aplicada
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="conferenciaFinal"
                  checked={conferenciaFinal}
                  onCheckedChange={(checked) => setConferenciaFinal(checked === true)}
                />
                <Label htmlFor="conferenciaFinal" className="cursor-pointer text-sm">
                  Conferência final realizada
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="prontoEntrega"
                  checked={prontoParaEntrega}
                  onCheckedChange={(checked) => setProntoParaEntrega(checked === true)}
                />
                <Label htmlFor="prontoEntrega" className="cursor-pointer text-sm font-medium">
                  ✓ Material pronto para entrega
                </Label>
              </div>
            </div>
          </>
        );

      case "expedicao":
        return (
          <>
            <div className="space-y-2">
              <Label>Localização no Estoque</Label>
              <Input
                placeholder="Ex: Prateleira A3, Gaveta 5..."
                value={localizacaoEstoque}
                onChange={(e) => setLocalizacaoEstoque(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações para Entrega</Label>
              <Textarea
                placeholder="Instruções especiais, horário preferido, etc..."
                value={observacoesEntrega}
                onChange={(e) => setObservacoesEntrega(e.target.value)}
                rows={3}
              />
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Ao confirmar, a OS ficará disponível para retirada pelo cliente ou entrega.
              </AlertDescription>
            </Alert>
          </>
        );

      case "entregue":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Motorista</Label>
                <Select value={motoristaId} onValueChange={setMotoristaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retirada-cliente">Retirada pelo Cliente</SelectItem>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Recebedor</Label>
                <Input
                  placeholder="Nome completo"
                  value={nomeRecebedor}
                  onChange={(e) => setNomeRecebedor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Documento (RG/CPF)</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={documentoRecebedor}
                  onChange={(e) => setDocumentoRecebedor(e.target.value)}
                />
              </div>
            </div>
            <Alert className="bg-success/10 border-success/30">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                A OS será finalizada e marcada como entregue.
              </AlertDescription>
            </Alert>
          </>
        );

      default:
        return null;
    }
  };

  // Determinar título e descrição baseado na etapa ATUAL
  const tituloModal = etapaLabels[etapaAtual] || etapaAtual;
  const descricaoModal = etapaDescricoes[etapaAtual] || "Preencha os dados para registrar esta etapa.";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Registrar {tituloModal}
          </DialogTitle>
          <DialogDescription>
            {descricaoModal}
          </DialogDescription>
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
            <Label>Observações Gerais</Label>
            <Textarea
              placeholder="Informações adicionais sobre esta etapa..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
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
