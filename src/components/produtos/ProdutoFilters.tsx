import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const alphabet = ["TODOS", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

export const CATEGORIAS = [
  { value: "enxoval_cama", label: "Enxoval de Cama" },
  { value: "enxoval_banho", label: "Enxoval de Banho" },
  { value: "enxoval_mesa", label: "Enxoval de Mesa" },
  { value: "uniformes", label: "Uniformes" },
  { value: "epis", label: "EPIs" },
  { value: "hospitalares", label: "Hospitalares" },
  { value: "hotelaria", label: "Hotelaria" },
  { value: "restaurantes", label: "Restaurantes" },
  { value: "cortinas", label: "Cortinas/Decoração" },
  { value: "outros", label: "Outros" },
];

export const PROCESSOS_LAVAGEM = [
  { value: "normal", label: "Normal" },
  { value: "delicado", label: "Delicado" },
  { value: "hospitalar", label: "Hospitalar" },
  { value: "industrial_pesado", label: "Industrial Pesado" },
  { value: "impermeavel", label: "Impermeável" },
  { value: "a_seco", label: "A Seco" },
];

export const COMPOSICOES = [
  { value: "algodao", label: "100% Algodão" },
  { value: "poliester", label: "100% Poliéster" },
  { value: "misto", label: "Misto (Algodão/Poliéster)" },
  { value: "linho", label: "Linho" },
  { value: "microfibra", label: "Microfibra" },
  { value: "sintetico", label: "Sintético" },
  { value: "outro", label: "Outro" },
];

export const CORES = [
  { value: "branco", label: "Branco" },
  { value: "colorido", label: "Colorido" },
  { value: "escuro", label: "Escuro" },
];

interface ProdutoFiltersProps {
  selectedLetter: string;
  onLetterChange: (letter: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedCategoria: string;
  onCategoriaChange: (categoria: string) => void;
  selectedUnidadeNegocio: string;
  onUnidadeNegocioChange: (unidade: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
}

export function ProdutoFilters({
  selectedLetter,
  onLetterChange,
  searchTerm,
  onSearchChange,
  selectedCategoria,
  onCategoriaChange,
  selectedUnidadeNegocio,
  onUnidadeNegocioChange,
  selectedStatus,
  onStatusChange,
}: ProdutoFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Search and Dropdowns */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou nome..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <Select value={selectedCategoria} onValueChange={onCategoriaChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Categorias</SelectItem>
            {CATEGORIAS.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedUnidadeNegocio} onValueChange={onUnidadeNegocioChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Un. Negócio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="ID1">Industrial (ID1)</SelectItem>
            <SelectItem value="ID2">Residencial (ID2)</SelectItem>
            <SelectItem value="ambos">Ambos (ID1+ID2)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alphabet Filter */}
      <div className="flex gap-0.5 flex-wrap">
        {alphabet.map((letter) => (
          <button
            key={letter}
            onClick={() => onLetterChange(letter)}
            className={cn(
              "min-w-[28px] h-7 px-1.5 rounded text-xs font-medium transition-colors",
              selectedLetter === letter
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  );
}
