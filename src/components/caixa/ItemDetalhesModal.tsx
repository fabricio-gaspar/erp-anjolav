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
import { AlertTriangle, Palette, Tag, MapPin, MessageSquare, Plus, X } from "lucide-react";
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
}

interface ItemDetalhesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemNome: string;
  quantidade: number;
  detalhes: ItemDetalhes;
  onSave: (detalhes: ItemDetalhes) => void;
}

export function ItemDetalhesModal({
  open,
  onOpenChange,
  itemNome,
  quantidade,
  detalhes,
  onSave,
}: ItemDetalhesModalProps) {
  const [corSelecionada, setCorSelecionada] = useState(detalhes.cor_item || "");
  const [corOutra, setCorOutra] = useState("");
  const [marcaSelecionada, setMarcaSelecionada] = useState(detalhes.marca_item || "");
  const [marcaOutra, setMarcaOutra] = useState("");
  const [showMarcaInput, setShowMarcaInput] = useState(false);
  const [corredor, setCorredor] = useState("");
  const [secao, setSecao] = useState("");
  const [prateleira, setPrateleira] = useState("");
  const [avarias, setAvarias] = useState(detalhes.avarias || "");
  const [observacoes, setObservacoes] = useState(detalhes.observacoes || "");

  useEffect(() => {
    if (open) {
      // Parse existing position
      if (detalhes.posicao_prateleira) {
        const parts = detalhes.posicao_prateleira.split("-");
        if (parts.length === 3) {
          setCorredor(parts[0]);
          setSecao(parts[1]);
          setPrateleira(parts[2]);
        }
      }
      
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
      setObservacoes(detalhes.observacoes || "");
    }
  }, [open, detalhes]);

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
    const cor = corSelecionada === "Outra" ? corOutra : corSelecionada;
    const marca = showMarcaInput ? marcaOutra.trim() : marcaSelecionada;
    const posicao = corredor && secao && prateleira 
      ? `${corredor}-${secao}-${prateleira}` 
      : undefined;

    onSave({
      cor_item: cor || undefined,
      marca_item: marca || undefined,
      avarias: avarias || undefined,
      posicao_prateleira: posicao,
      observacoes: observacoes || undefined,
    });
    onOpenChange(false);
  };

  const hasContent = corSelecionada || marcaSelecionada || avarias || observacoes || (corredor && secao && prateleira);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Detalhes do Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-semibold text-foreground">{itemNome}</p>
            <p className="text-sm text-muted-foreground">Quantidade: {quantidade}</p>
          </div>

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

          {/* Posição na Prateleira */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Posição na Prateleira (após finalização)
            </Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Corredor"
                  value={corredor}
                  onChange={(e) => setCorredor(e.target.value.toUpperCase())}
                  maxLength={3}
                  className="text-center"
                />
                <span className="text-xs text-muted-foreground">Corredor</span>
              </div>
              <span className="self-center text-muted-foreground">-</span>
              <div className="flex-1">
                <Input
                  placeholder="Seção"
                  value={secao}
                  onChange={(e) => setSecao(e.target.value)}
                  maxLength={3}
                  className="text-center"
                />
                <span className="text-xs text-muted-foreground">Seção</span>
              </div>
              <span className="self-center text-muted-foreground">-</span>
              <div className="flex-1">
                <Input
                  placeholder="Prat."
                  value={prateleira}
                  onChange={(e) => setPrateleira(e.target.value)}
                  maxLength={3}
                  className="text-center"
                />
                <span className="text-xs text-muted-foreground">Prateleira</span>
              </div>
            </div>
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

          {/* Observações Gerais */}
          <div className="space-y-2">
            <Label>Observações Gerais</Label>
            <Textarea
              placeholder="Outras informações relevantes sobre o item..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar Detalhes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
