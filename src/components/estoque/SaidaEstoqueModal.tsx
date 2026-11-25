import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EstoqueProduto } from "@/hooks/useEstoque";
import { useMovimentacoesEstoque } from "@/hooks/useMovimentacoesEstoque";
import { createIdempotencyKey } from "@/lib/idempotency";
import { useEstoqueLocais } from "@/hooks/useCompras";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtos: EstoqueProduto[];
}

export function SaidaEstoqueModal({ open, onOpenChange, produtos }: Props) {
  const { registrarMovimentacao } = useMovimentacoesEstoque();
  const { funcionario, user } = useAuth();
  const { locais, saldos } = useEstoqueLocais({ enabled: open });
  const [form, setForm] = useState({ estoque_produto_id: "", estoque_local_id: "", quantidade: "", motivo: "" });
  const commandKey = useRef<string | null>(null);

  const produtoSelecionado = produtos.find((p) => p.id === form.estoque_produto_id);
  const localId = form.estoque_local_id || locais.find((local) => local.ativo)?.id || "";
  const saldoLocal = saldos.find((saldo) => saldo.estoque_produto_id === form.estoque_produto_id && saldo.estoque_local_id === localId)?.quantidade || 0;

  const salvar = async () => {
    const amount = Number(form.quantidade);
    if (!form.estoque_produto_id || !localId) {
      toast.error("Selecione o insumo e o local da retirada.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe uma quantidade maior que zero.");
      return;
    }
    if (amount > saldoLocal) {
      toast.error("A quantidade informada excede o saldo disponível neste local.");
      return;
    }
    if (form.motivo.trim().length < 3) {
      toast.error("Descreva o motivo da retirada.");
      return;
    }
    commandKey.current ??= createIdempotencyKey("stock-out");
    await registrarMovimentacao.mutateAsync({
      estoque_produto_id: form.estoque_produto_id,
      tipo: "saida",
      estoque_local_id: localId,
      quantidade: amount,
      motivo: form.motivo.trim(),
      idempotency_key: commandKey.current,
    });
    commandKey.current = null;
    setForm({ estoque_produto_id: "", estoque_local_id: "", quantidade: "", motivo: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) commandKey.current = null;
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="wide-form-dialog">
        <DialogHeader><DialogTitle>Saída de Estoque</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Retirada registrada para: </span>
            <strong>{funcionario?.nome || user?.email || "Usuário autenticado"}</strong>
          </div>
          <div>
            <Label>Produto *</Label>
            <Select value={form.estoque_produto_id} onValueChange={(v) => setForm({ ...form, estoque_produto_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{produtos.filter(p => p.ativo).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} ({p.quantidade_atual} {p.unidade})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Local de saída *</Label>
            <Select value={form.estoque_local_id} onValueChange={(v) => setForm({ ...form, estoque_local_id: v })}>
              <SelectTrigger><SelectValue placeholder={locais.find((local) => local.ativo)?.nome || "Selecione..."} /></SelectTrigger>
              <SelectContent>{locais.filter((local) => local.ativo).map((local) => <SelectItem key={local.id} value={local.id}>{local.codigo} · {local.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade * {produtoSelecionado && <span className="text-muted-foreground">(neste local: {saldoLocal} {produtoSelecionado.unidade})</span>}</Label>
            <Input type="number" min="0.001" step="0.001" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} max={saldoLocal} aria-label="Quantidade a retirar" />
          </div>
          <div><Label>Motivo da retirada *</Label><Textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} rows={2} placeholder="Ex.: consumo na produção, descarte ou uso interno" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={registrarMovimentacao.isPending || !produtoSelecionado || saldoLocal <= 0}>Registrar retirada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
