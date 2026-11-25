import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { AlertTriangle, Palette, Tag, MessageSquare, Plus, X, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

const CORES_PREDEFINIDAS = [
  "Branco",
  "Preto",
  "Azul",
  "Azul Marinho",
  "Vermelho",
  "Verde",
  "Amarelo",
  "Rosa",
  "Cinza",
  "Bege",
  "Marrom",
  "Estampado",
  "Listrado",
  "Outra",
];

const MARCAS_PREDEFINIDAS = [
  "Camesa",
  "Buddemeyer",
  "Karsten",
  "Santista",
  "Artex",
  "Dohler",
  "Trussardi",
  "MMartan",
  "Altenburg",
  "Teka",
  "Sultan",
  "Zelo",
  "Casa Moysés",
  "Lepper",
  "Kacyumara",
];

interface ItemDetalhes {
  cor_item?: string;
  marca_item?: string;
  avarias?: string;
  posicao_prateleira?: string;
  observacoes?: string;
  operacao?: string;
  tipo_preco?: string;
  servicos_adicionais?: string[];
  complemento?: string;
  metragem_m2?: number;
  largura_m?: number;
  comprimento_m?: number;
  lacre?: string;
}

interface ItemDetalhesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemNome: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  unidadePreco: string;
  detalhes: ItemDetalhes;
  onSave: (detalhes: ItemDetalhes) => void;
}

const parseMeasurement = (value: string | number | undefined) => {
  const numeric = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const isValidMeasurementInput = (value: string, decimals: number) => {
  if (!value.trim()) return true;
  const pattern = decimals === 2 ? /^\d{1,3}(?:[.,]\d{1,2})?$/ : /^\d{1,3}(?:[.,]\d{1,4})?$/;
  return pattern.test(value.trim());
};

const formatMeasurement = (value?: number | null, maxDigits = 2) => value == null
  ? ""
  : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: maxDigits }).format(value);

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

const isMeterUnit = (unit: string) => ["mt", "m", "metro", "metros", "m²", "m2"].includes(unit.trim().toLowerCase());

export function ItemDetalhesModal({
  open,
  onOpenChange,
  itemNome,
  quantidade,
  unidade,
  precoUnitario,
  unidadePreco,
  detalhes,
  onSave,
}: ItemDetalhesModalProps) {
  const isMeterItem = isMeterUnit(unidade);
  const [corSelecionada, setCorSelecionada] = useState(detalhes.cor_item || "");
  const [corOutra, setCorOutra] = useState("");
  const [marcaSelecionada, setMarcaSelecionada] = useState(detalhes.marca_item || "");
  const [marcaOutra, setMarcaOutra] = useState("");
  const [showMarcaInput, setShowMarcaInput] = useState(false);
  const [avarias, setAvarias] = useState(detalhes.avarias || "");
  const [operacao, setOperacao] = useState(detalhes.operacao || "lavagem_passadoria");
  const [servicosAdicionais, setServicosAdicionais] = useState<string[]>(detalhes.servicos_adicionais || []);
  const [complemento, setComplemento] = useState(detalhes.complemento || "");
  const [largura, setLargura] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [metragem, setMetragem] = useState("");
  const [lacre, setLacre] = useState("");

  useEffect(() => {
    if (open) {
      // Check if color is custom
      if (detalhes.cor_item && !CORES_PREDEFINIDAS.includes(detalhes.cor_item)) {
        setCorSelecionada("Outra");
        setCorOutra(detalhes.cor_item);
      } else {
        setCorSelecionada(detalhes.cor_item || "");
        setCorOutra("");
      }
      
      // Check if brand is custom
      if (detalhes.marca_item && !MARCAS_PREDEFINIDAS.includes(detalhes.marca_item)) {
        setMarcaSelecionada(detalhes.marca_item);
        setMarcaOutra(detalhes.marca_item);
        setShowMarcaInput(true);
      } else {
        setMarcaSelecionada(detalhes.marca_item || "");
        setMarcaOutra("");
        setShowMarcaInput(false);
      }
      
      setAvarias(detalhes.avarias || "");
      setOperacao(detalhes.operacao || "lavagem_passadoria");
      setServicosAdicionais(detalhes.servicos_adicionais || []);
      setComplemento(detalhes.complemento || "");
      setLargura(formatMeasurement(detalhes.largura_m));
      setComprimento(formatMeasurement(detalhes.comprimento_m));
      setMetragem(formatMeasurement(detalhes.metragem_m2, 4));
      setLacre(detalhes.lacre || "");
    }
  }, [open, detalhes]);

  const larguraNumerica = parseMeasurement(largura);
  const comprimentoNumerico = parseMeasurement(comprimento);
  const medidasIniciadas = Boolean(largura.trim() || comprimento.trim());
  const medidasValidas = isValidMeasurementInput(largura, 2)
    && isValidMeasurementInput(comprimento, 2)
    && (!medidasIniciadas || Boolean(larguraNumerica && comprimentoNumerico));
  const areaCalculada = medidasValidas && larguraNumerica && comprimentoNumerico
    ? Number((larguraNumerica * comprimentoNumerico).toFixed(4))
    : null;
  const areaDiretaValida = isValidMeasurementInput(metragem, 4);
  const metragemNumerica = areaCalculada ?? (!medidasIniciadas && areaDiretaValida ? parseMeasurement(metragem) : null);
  const areaValida = Boolean(metragemNumerica && metragemNumerica <= 999);
  const totalItem = areaValida ? Math.round((precoUnitario * Number(metragemNumerica) + Number.EPSILON) * 100) / 100 : 0;

  const handleMarcaSelect = (marca: string) => {
    setMarcaSelecionada(marca);
    setShowMarcaInput(false);
    setMarcaOutra("");
  };

  const handleAddCustomMarca = () => {
    setShowMarcaInput(true);
    setMarcaSelecionada("");
  };

  const handleCustomMarcaConfirm = () => {
    if (marcaOutra.trim()) {
      setMarcaSelecionada(marcaOutra.trim());
    }
  };

  const handleSave = () => {
    if (isMeterItem && !areaValida) return;
    const cor = corSelecionada === "Outra" ? corOutra : corSelecionada;
    const marca = showMarcaInput ? marcaOutra.trim() : marcaSelecionada;

    onSave({
      cor_item: cor || undefined,
      marca_item: marca || undefined,
      avarias: avarias || undefined,
      // Mantém os dados antigos sem expô-los nesta tela do PDV.
      posicao_prateleira: detalhes.posicao_prateleira,
      observacoes: detalhes.observacoes,
      operacao,
      tipo_preco: isMeterItem ? "metro" : unidade.toLowerCase() === "kg" ? "peso" : "quantidade",
      servicos_adicionais: servicosAdicionais,
      complemento: complemento || undefined,
      ...(isMeterItem ? {
        metragem_m2: metragemNumerica ?? undefined,
        largura_m: larguraNumerica ?? undefined,
        comprimento_m: comprimentoNumerico ?? undefined,
        lacre: lacre.trim() || undefined,
      } : {}),
    });
    onOpenChange(false);
  };

  const toggleServico = (servico: string) => {
    setServicosAdicionais((current) => current.includes(servico)
      ? current.filter((item) => item !== servico)
      : [...current, servico]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Identificação e detalhes do item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-semibold text-foreground">{itemNome}</p>
            <p className="text-sm text-muted-foreground">
              {isMeterItem
                ? detalhes.metragem_m2 ? `Área lançada: ${formatMeasurement(detalhes.metragem_m2, 4)} m²` : "Informe as dimensões para calcular a área"
                : `${unidadePreco === "kg" ? "Peso" : "Quantidade"}: ${quantidade} ${unidadePreco}`}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Operação</Label>
              <Select value={operacao} onValueChange={setOperacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lavagem_passadoria">Lavagem + Passadoria</SelectItem>
                  <SelectItem value="lavagem">Lavar</SelectItem>
                  <SelectItem value="passadoria">Passar</SelectItem>
                  <SelectItem value="secagem">Secar</SelectItem>
                  <SelectItem value="servico">Serviço especializado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Cobrança cadastrada:</span>{" "}
              <strong>{formatCurrency(precoUnitario)} / {unidadePreco}</strong>
            </div>
          </div>

          {isMeterItem && (
            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
              <div>
                <p className="font-semibold text-foreground">Medidas e cobrança por área</p>
                <p className="text-xs text-muted-foreground">Informe largura e comprimento em metros. O PDV calcula m² × preço por m²; centímetros também contam (ex.: 3,25 × 2,75).</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="item-largura-m">Largura (m)</Label>
                  <Input
                    id="item-largura-m"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex.: 2,00"
                    maxLength={6}
                    value={largura}
                    onChange={(event) => setLargura(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-comprimento-m">Comprimento (m)</Label>
                  <Input
                    id="item-comprimento-m"
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex.: 3,00"
                    maxLength={6}
                    value={comprimento}
                    onChange={(event) => setComprimento(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-metragem-m2">Metragem total (m²)</Label>
                <Input
                  id="item-metragem-m2"
                  type="text"
                  inputMode="decimal"
                  placeholder="Informe diretamente se não for retangular"
                  value={areaCalculada ? formatMeasurement(areaCalculada, 4) : metragem}
                  onChange={(event) => setMetragem(event.target.value)}
                  readOnly={medidasIniciadas}
                  maxLength={8}
                  className={medidasIniciadas ? "bg-muted" : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  {areaCalculada
                    ? `Área calculada: ${formatMeasurement(areaCalculada, 4)} m²`
                    : medidasIniciadas
                      ? "Preencha as duas medidas para calcular a área, ou apague ambas para informar a área diretamente."
                      : "Para formatos irregulares, informe diretamente a área total em m²."}
                </p>
                {(!medidasValidas || !areaDiretaValida || (metragem.trim() && !metragemNumerica) || (metragemNumerica && metragemNumerica > 999)) && (
                  <p role="alert" className="text-xs font-medium text-destructive">Informe medidas válidas com até 2 casas decimais e uma área maior que zero (máximo 999 m²).</p>
                )}
                {areaValida && (
                  <div className="rounded-md border border-primary/20 bg-background px-3 py-2 text-sm">
                    <p className="text-muted-foreground">{formatCurrency(precoUnitario)} / m² × {formatMeasurement(Number(metragemNumerica), 4)} m²</p>
                    <p className="font-bold text-foreground">Total do item: {formatCurrency(totalItem)}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-lacre">Número do lacre</Label>
                <Input
                  id="item-lacre"
                  type="text"
                  inputMode="numeric"
                  maxLength={30}
                  placeholder="Ex.: 000123"
                  value={lacre}
                  onChange={(event) => setLacre(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Informe o número do lacre fixado no tapete para conferência.</p>
              </div>
            </div>
          )}

          {/* Cor */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Cor do Item
            </Label>
            <Select value={corSelecionada} onValueChange={setCorSelecionada}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a cor..." />
              </SelectTrigger>
              <SelectContent>
                {CORES_PREDEFINIDAS.map((cor) => (
                  <SelectItem key={cor} value={cor}>
                    {cor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {corSelecionada === "Outra" && (
              <Input
                placeholder="Digite a cor..."
                value={corOutra}
                onChange={(e) => setCorOutra(e.target.value)}
              />
            )}
          </div>

          {/* Marca */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Marca
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {MARCAS_PREDEFINIDAS.map((marca) => (
                <Badge
                  key={marca}
                  variant={marcaSelecionada === marca && !showMarcaInput ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => handleMarcaSelect(marca)}
                >
                  {marca}
                </Badge>
              ))}
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-primary/20 transition-colors border-dashed"
                onClick={handleAddCustomMarca}
              >
                <Plus className="w-3 h-3 mr-1" />
                Outra
              </Badge>
            </div>
            {showMarcaInput && (
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Digite a marca..."
                  value={marcaOutra}
                  onChange={(e) => setMarcaOutra(e.target.value)}
                  onBlur={handleCustomMarcaConfirm}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomMarcaConfirm()}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowMarcaInput(false);
                    setMarcaOutra("");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            {marcaSelecionada && (
              <p className="text-sm text-muted-foreground">
                Selecionada: <span className="font-medium text-foreground">{marcaSelecionada}</span>
              </p>
            )}
          </div>

          {/* Avarias */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-4 h-4" />
              Avarias / Condição na Entrada
            </Label>
            <Textarea
              placeholder="Descreva manchas, rasgos, desgastes ou outras condições observadas na peça..."
              value={avarias}
              onChange={(e) => setAvarias(e.target.value)}
              rows={3}
              className={avarias ? "border-warning" : ""}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Serviços adicionais</Label>
            <div className="flex flex-wrap gap-2">
              {["Tira-manchas", "Higienização", "Passadoria especial", "Embalagem", "Impermeabilização"].map((servico) => (
                <button
                  key={servico}
                  type="button"
                  onClick={() => toggleServico(servico)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${servicosAdicionais.includes(servico) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}
                >
                  {servico}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input
              placeholder="Ex.: dobrar separado, embalar individualmente..."
              value={complemento}
              onChange={(event) => setComplemento(event.target.value)}
            />
          </div>

        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isMeterItem && !areaValida}>
            Salvar Detalhes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
