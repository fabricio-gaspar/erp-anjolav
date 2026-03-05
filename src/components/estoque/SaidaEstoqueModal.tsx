import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EstoqueProduto } from "@/hooks/useEstoque";
import { useMovimentacoesEstoque } from "@/hooks/useMovimentacoesEstoque";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtos: EstoqueProduto[];
}

export function SaidaEstoqueModal({ open, onOpenChange, produtos }: Props) {
  const { registrarMovimentacao } = useMovimentacoesEstoque();
  const [form, setForm] = useState({ estoque_produto_id: "", quantidade: "", motivo: "" });

  const produtoSelecionado = produtos.find((p) => p.id === form.estoque_produto_id);

  const salvar = async () => {
    if (!form.estoque_produto_id || !form.quantidade) return;
    await registrarMovimentacao.mutateAsync({
      estoque_produto_id: form.estoque_produto_id,
      tipo: "saida",
      quantidade: Number(form.quantidade),
      motivo: form.motivo || "Consumo",
    });
    setForm({ estoque_produto_id: "", quantidade: "", motivo: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Saída de Estoque</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Produto *</Label>
            <Select value={form.estoque_produto_id} onValueChange={(v) => setForm({ ...form, estoque_produto_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{produtos.filter(p => p.ativo).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} ({p.quantidade_atual} {p.unidade})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade * {produtoSelecionado && <span className="text-muted-foreground">(disponível: {produtoSelecionado.quantidade_atual})</span>}</Label>
            <Input type="number" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} max={produtoSelecionado?.quantidade_atual} />
          </div>
          <div><Label>Motivo</Label><Textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} rows={2} placeholder="Ex: Consumo produção, descarte..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={registrarMovimentacao.isPending}>Registrar Saída</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
