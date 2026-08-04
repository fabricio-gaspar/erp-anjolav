import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, X } from "lucide-react";
import { CATEGORIAS, PROCESSOS_LAVAGEM, COMPOSICOES, CORES } from "./ProdutoFilters";

export interface ProdutoFormData {
  codigo: string;
  nome: string;
  categoria: string;
  preco: number;
  unidade: string;
  unidade_negocio: string;
  status: string;
  descricao: string;
  peso_medio_kg: number;
  tempo_processo_min: number;
  processo_lavagem: string;
  temperatura_maxima: number;
  requer_secadora: boolean;
  cor: string;
  composicao: string;
  instrucoes_especiais: string;
}

interface ProdutoFormProps {
  formData: ProdutoFormData;
  onChange: (data: Partial<ProdutoFormData>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
  isSaving: boolean;
}

export function ProdutoForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  isEditing,
  isSaving,
}: ProdutoFormProps) {
  return (
    <div className="mt-4 space-y-6">
      {/* Seção 1: Identificação */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">Identificação</h4>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Código/SKU</Label>
            <Input
              className="mt-1 font-mono"
              placeholder="EX: LAV001"
              value={formData.codigo}
              onChange={(e) => onChange({ codigo: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Nome do Serviço/Produto *</Label>
            <Input
              className="mt-1"
              placeholder="EX: LENÇOL SOLTEIRO"
              value={formData.nome}
              onChange={(e) => onChange({ nome: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={formData.categoria} onValueChange={(v) => onChange({ categoria: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={formData.status} onValueChange={(v) => onChange({ status: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Seção 2: Precificação */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">Precificação</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Unidade de Negócio</Label>
            <Select value={formData.unidade_negocio} onValueChange={(v) => onChange({ unidade_negocio: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Ambos (ID1+ID2)</SelectItem>
                <SelectItem value="ID1">Industrial (ID1)</SelectItem>
                <SelectItem value="ID2">Residencial (ID2)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Unidade de Cobrança</Label>
            <Select value={formData.unidade} onValueChange={(v) => onChange({ unidade: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Quilo (Kg)</SelectItem>
                <SelectItem value="peca">Peça</SelectItem>
                <SelectItem value="metro">Metro</SelectItem>
                <SelectItem value="unidade">Unidade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Preço Padrão</Label>
            <CurrencyInput
              className="mt-1"
              value={formData.preco}
              onValueChange={(num) => onChange({ preco: num })}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Peso Médio (Kg)</Label>
            <Input
              className="mt-1"
              type="number"
              step="0.01"
              min="0"
              placeholder="Para estimativas"
              value={formData.peso_medio_kg || ""}
              onChange={(e) => onChange({ peso_medio_kg: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      {/* Seção 3: Processo de Lavagem */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">Processo de Lavagem</h4>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Processo</Label>
            <Select value={formData.processo_lavagem} onValueChange={(v) => onChange({ processo_lavagem: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PROCESSOS_LAVAGEM.map((proc) => (
                  <SelectItem key={proc.value} value={proc.value}>
                    {proc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Temp. Máxima (°C)</Label>
            <Input
              className="mt-1"
              type="number"
              min="0"
              max="100"
              value={formData.temperatura_maxima}
              onChange={(e) => onChange({ temperatura_maxima: parseInt(e.target.value) || 60 })}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Tempo Processo (min)</Label>
            <Input
              className="mt-1"
              type="number"
              min="0"
              value={formData.tempo_processo_min}
              onChange={(e) => onChange({ tempo_processo_min: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <Select value={formData.cor} onValueChange={(v) => onChange({ cor: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {CORES.map((cor) => (
                  <SelectItem key={cor.value} value={cor.value}>
                    {cor.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Composição</Label>
            <Select value={formData.composicao} onValueChange={(v) => onChange({ composicao: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {COMPOSICOES.map((comp) => (
                  <SelectItem key={comp.value} value={comp.value}>
                    {comp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2 pb-1">
            <Switch
              checked={formData.requer_secadora}
              onCheckedChange={(v) => onChange({ requer_secadora: v })}
            />
            <Label className="text-xs text-muted-foreground">Requer Secadora</Label>
          </div>
        </div>
      </div>

      {/* Seção 4: Observações */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">Observações</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Descrição Detalhada</Label>
            <Textarea
              className="mt-1"
              placeholder="Descreva detalhes técnicos do produto..."
              rows={3}
              value={formData.descricao}
              onChange={(e) => onChange({ descricao: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Instruções Especiais de Manuseio</Label>
            <Textarea
              className="mt-1"
              placeholder="Cuidados especiais durante a lavagem..."
              rows={3}
              value={formData.instrucoes_especiais}
              onChange={(e) => onChange({ instrucoes_especiais: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
          {isEditing ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </div>
  );
}
