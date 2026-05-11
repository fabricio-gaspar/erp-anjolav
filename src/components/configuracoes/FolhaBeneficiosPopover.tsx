import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2 } from "lucide-react";
import {
  useFolhaBeneficiosByFolha,
  useAddFolhaBeneficio,
  useDeleteFolhaBeneficio,
} from "@/hooks/useFolhaBeneficios";
import { formatNumberToCurrency, parseCurrencyToNumber, formatCurrencyInput } from "@/lib/currencyUtils";

interface Props {
  folhaId: string;
  funcionarioId: string;
  disabled?: boolean;
}

export function FolhaBeneficiosPopover({ folhaId, funcionarioId, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const { data: beneficios = [] } = useFolhaBeneficiosByFolha([folhaId]);
  const add = useAddFolhaBeneficio();
  const del = useDeleteFolhaBeneficio();

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Vale");
  const [tipo, setTipo] = useState<"beneficio" | "desconto">("beneficio");
  const [valor, setValor] = useState("");

  const handleAdd = async () => {
    if (!nome.trim() || !valor) return;
    await add.mutateAsync({
      folha_id: folhaId,
      funcionario_id: funcionarioId,
      nome: nome.trim(),
      categoria,
      tipo,
      valor: parseCurrencyToNumber(formatCurrencyInput(valor)),
      observacao: null,
    });
    setNome("");
    setValor("");
  };

  const total = beneficios.reduce(
    (s, b) => s + (b.tipo === "beneficio" ? Number(b.valor) : -Number(b.valor)),
    0,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled}
          className="h-7 w-7 relative"
          title="Cadastrar benefício/desconto extra"
        >
          <Plus className="w-4 h-4" />
          {beneficios.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] rounded-full px-1 leading-none py-0.5">
              {beneficios.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm">Benefícios e descontos extras</h4>
            <p className="text-xs text-muted-foreground">Aparecem separados no relatório mensal.</p>
          </div>

          {beneficios.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2">
              {beneficios.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-xs">
                  <div className="flex-1">
                    <div className="font-medium">{b.nome}</div>
                    <div className="text-muted-foreground">{b.categoria}</div>
                  </div>
                  <div className={b.tipo === "desconto" ? "text-destructive" : "text-foreground"}>
                    {b.tipo === "desconto" ? "-" : "+"} R$ {formatNumberToCurrency(Number(b.valor))}
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 ml-1" onClick={() => del.mutate(b.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
              <div className="border-t pt-1 flex justify-between text-xs font-semibold">
                <span>Total líquido</span>
                <span>R$ {formatNumberToCurrency(total)}</span>
              </div>
            </div>
          )}

          {!disabled && (
            <div className="space-y-2 border-t pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Vale combustível" className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <select className="border rounded h-8 px-2 w-full bg-background text-sm" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    <option value="Vale">Vale</option>
                    <option value="Bonificação">Bonificação</option>
                    <option value="Premiação">Premiação</option>
                    <option value="Adiantamento">Adiantamento</option>
                    <option value="Empréstimo">Empréstimo</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <select className="border rounded h-8 px-2 w-full bg-background text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                    <option value="beneficio">Benefício (+)</option>
                    <option value="desconto">Desconto (-)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input value={valor} onChange={(e) => setValor(formatCurrencyInput(e.target.value))} placeholder="0,00" className="h-8" />
                </div>
              </div>
              <Button size="sm" onClick={handleAdd} disabled={!nome.trim() || !valor || add.isPending} className="w-full">
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
