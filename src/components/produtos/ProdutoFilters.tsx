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
  availableBusinessUnits: readonly string[] | null;
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
  availableBusinessUnits,
}: ProdutoFiltersProps) {
  const businessUnits = [
    { value: "ID1", label: "Industrial (ID1)" },
    { value: "ID2", label: "Doméstico (ID2)" },
    { value: "ambos", label: "Compartilhado" },
  ].filter(unit => availableBusinessUnits === null || availableBusinessUnits.includes(unit.value));

  return (
    <div className="space-y-4">
      {/* Search and Dropdowns */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_180px_150px]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou nome..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Pesquisar produtos por código ou nome"
          />
        </div>

        <Select value={selectedCategoria} onValueChange={onCategoriaChange}>
          <SelectTrigger className="w-full" aria-label="Filtrar produtos por categoria">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIAS.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedUnidadeNegocio} onValueChange={onUnidadeNegocioChange}>
          <SelectTrigger className="w-full" aria-label="Filtrar produtos por unidade de negócio">
            <SelectValue placeholder="Un. Negócio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda a operação</SelectItem>
            {businessUnits.map(unit => (
              <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full" aria-label="Filtrar produtos por situação">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Arquivados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alphabet Filter */}
      <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-1">
        <div className="flex gap-0.5 min-w-max sm:flex-wrap sm:min-w-0">
          {alphabet.map((letter) => (
            <button
              type="button"
              key={letter}
              onClick={() => onLetterChange(letter)}
              aria-pressed={selectedLetter === letter}
              aria-label={letter === "TODOS" ? "Todos os produtos" : `Produtos iniciados por ${letter}`}
              className={cn(
                "h-9 min-w-9 rounded px-2 text-xs font-medium transition-colors",
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
    </div>
  );
}
