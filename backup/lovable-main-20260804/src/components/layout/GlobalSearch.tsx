import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, Package, Building2, ClipboardList, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useGlobalSearch, type GlobalSearchResult } from "@/hooks/useGlobalSearch";

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
  ordem: "Ordens de Serviço",
  lancamento: "Lançamentos",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { data: results = [], isFetching } = useGlobalSearch(term);
  const navigate = useNavigate();

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

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden md:flex gap-2 text-white/70 hover:text-white hover:bg-white/10"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Buscar...</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-white/20 bg-white/10 px-1.5 font-mono text-[10px] font-medium text-white/60">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar clientes, OS, produtos, fornecedores..."
          value={term}
          onValueChange={setTerm}
        />
        <CommandList>
          {term.trim().length < 2 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Digite ao menos 2 caracteres para buscar.
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
                      <CommandItem key={`${type}-${r.id}`} value={`${type}-${r.label}-${r.id}`} onSelect={() => handleSelect(r)}>
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
