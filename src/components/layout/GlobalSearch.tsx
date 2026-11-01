import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, Package, Building2, ClipboardList, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  sanitizeGlobalSearchTerm,
  useGlobalSearch,
  type GlobalSearchResult,
} from "@/hooks/useGlobalSearch";

const ICONS: Record<GlobalSearchResult["type"], React.ElementType> = {
  cliente: Users,
  produto: Package,
  fornecedor: Building2,
  ordem: ClipboardList,
  lancamento: Receipt,
};

const GROUP_LABELS: Record<GlobalSearchResult["type"], string> = {
  cliente: "Clientes",
  produto: "Produtos",
  fornecedor: "Fornecedores",
  ordem: "Pedidos / ROLs",
  lancamento: "Lançamentos",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { data: results = [], isFetching } = useGlobalSearch(term);
  const navigate = useNavigate();
  const hasMinimumTerm = sanitizeGlobalSearchTerm(term).replace(/\s/g, "").length >= 2;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const grouped = results.reduce<Record<string, GlobalSearchResult[]>>((acc, r) => {
    (acc[r.type] = acc[r.type] || []).push(r);
    return acc;
  }, {});

  const handleSelect = (r: GlobalSearchResult) => {
    setOpen(false);
    setTerm("");
    navigate(r.route);
  };

  const getSearchableItemValue = (result: GlobalSearchResult) => {
    const rawValue = [term, result.type, result.label, result.sublabel, result.id]
      .filter(Boolean)
      .join(" ");
    const normalizedValue = sanitizeGlobalSearchTerm(rawValue);
    const digitsOnly = rawValue.replace(/\D/g, "");
    return `${rawValue} ${normalizedValue} ${digitsOnly}`;
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Buscar no sistema"
        className={cn(
          "flex h-9 w-9 gap-2 px-0 transition-colors hover:bg-opacity-10 md:w-auto md:px-3",
          "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        <Search className="w-4 h-4" />
        <span className="hidden text-sm md:inline">Buscar...</span>
        <kbd className={cn(
          "hidden lg:inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium",
          "border-border bg-muted text-muted-foreground"
        )}>
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Cliente, CPF/CNPJ, telefone ou pedido/ROL..."
          value={term}
          onValueChange={setTerm}
          className="text-base sm:text-sm"
        />
        <CommandList>
          {!hasMinimumTerm ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Busque por nome, razão social ou fantasia, CPF/CNPJ, telefone e número do pedido/ROL.
            </div>
          ) : isFetching ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Buscando...</div>
          ) : (
            <>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              {Object.entries(grouped).map(([type, items]) => {
                const Icon = ICONS[type as GlobalSearchResult["type"]];
                return (
                  <CommandGroup key={type} heading={GROUP_LABELS[type as GlobalSearchResult["type"]]}>
                    {items.map((r) => (
                      <CommandItem
                        key={`${type}-${r.id}`}
                        value={getSearchableItemValue(r)}
                        onSelect={() => handleSelect(r)}
                      >
                        <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-sm">{r.label}</span>
                          {r.sublabel && (
                            <span className="text-xs text-muted-foreground">{r.sublabel}</span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
