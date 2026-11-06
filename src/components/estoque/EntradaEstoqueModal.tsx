import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EstoqueProduto } from "@/hooks/useEstoque";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useMovimentacoesEstoque } from "@/hooks/useMovimentacoesEstoque";
import { createIdempotencyKey } from "@/lib/idempotency";
import { useEstoqueLocais } from "@/hooks/useCompras";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtos: EstoqueProduto[];
}

export function EntradaEstoqueModal({ open, onOpenChange, produtos }: Props) {
  const { fornecedores } = useFornecedores();
  const { registrarMovimentacao } = useMovimentacoesEstoque();
  const { locais } = useEstoqueLocais({ enabled: open, includeBalances: false });
  const [form, setForm] = useState({ estoque_produto_id: "", estoque_local_id: "", quantidade: "", custo_unitario: "", fornecedor_id: "", motivo: "" });
  const commandKey = useRef<string | null>(null);

  const salvar = async () => {
    const localId = form.estoque_local_id || locais.find((local) => local.ativo)?.id;
    if (!form.estoque_produto_id || !localId || !form.quantidade) return;
    commandKey.current ??= createIdempotencyKey("stock-in");
    await registrarMovimentacao.mutateAsync({
      estoque_produto_id: form.estoque_produto_id,
      tipo: "entrada",
      quantidade: Number(form.quantidade),
      custo_unitario: form.custo_unitario ? Number(form.custo_unitario) : undefined,
      fornecedor_id: form.fornecedor_id || undefined,
      estoque_local_id: localId,
      motivo: form.motivo || "Compra",
      idempotency_key: commandKey.current,
    });
    commandKey.current = null;
    setForm({ estoque_produto_id: "", estoque_local_id: "", quantidade: "", custo_unitario: "", fornecedor_id: "", motivo: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) commandKey.current = null;
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="wide-form-dialog">
        <DialogHeader><DialogTitle>Entrada de Estoque</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Produto *</Label>
            <Select value={form.estoque_produto_id} onValueChange={(v) => setForm({ ...form, estoque_produto_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{produtos.filter(p => p.ativo).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Local de entrada *</Label>
            <Select value={form.estoque_local_id} onValueChange={(v) => setForm({ ...form, estoque_local_id: v })}>
              <SelectTrigger><SelectValue placeholder={locais.find((local) => local.ativo)?.nome || "Selecione..."} /></SelectTrigger>
              <SelectContent>{locais.filter((local) => local.ativo).map((local) => <SelectItem key={local.id} value={local.id}>{local.codigo} · {local.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Quantidade *</Label><Input type="number" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} /></div>
            <div><Label>Custo Unitário</Label><Input type="number" step="0.01" value={form.custo_unitario} onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })} /></div>
          </div>
          <div>
            <Label>Fornecedor</Label>
            <Select value={form.fornecedor_id} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{fornecedores.filter(f => f.ativo).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Motivo</Label><Textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={registrarMovimentacao.isPending}>Registrar Entrada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
