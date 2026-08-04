import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  useUpdateFichaFuncionario,
  calcularCustoMensal,
  type FichaFuncionarioData,
} from "@/hooks/useFichaFuncionario";
import {
  formatCurrencyInput,
  parseCurrencyToNumber,
  formatNumberToCurrency,
} from "@/lib/currencyUtils";
import type { Funcionario } from "@/hooks/useFuncionarios";

interface Props {
  funcionario: Funcionario | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const TIPOS_CONTRATO = ["CLT", "PJ", "Estágio", "Temporário", "Autônomo", "PRO-LABORE"];
const EMPREGADORES = [
  { cnpj: "23.227.029/0001-06", nome: "LAVANDERIA SAO ROQUE LTDA" },
  { cnpj: "08.350.030/0001-97", nome: "ANJOLAV" },
];
const REGIMES = ["mensalista", "horista", "comissionado"];
const ESTADO_CIVIL = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"];
const ESCOLARIDADE = [
  "Fundamental Incompleto",
  "Fundamental Completo",
  "Médio Incompleto",
  "Médio Completo",
  "Superior Incompleto",
  "Superior Completo",
  "Pós-graduação",
];
const TIPO_CONTA = ["corrente", "poupança"];
const TIPO_PIX = ["CPF", "CNPJ", "Email", "Telefone", "Aleatória"];

export function FichaFuncionarioModal({ funcionario, open, onOpenChange }: Props) {
  const update = useUpdateFichaFuncionario();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (funcionario) {
      const f: any = funcionario;
      setForm({
        ...f,
        endereco: f.endereco || {},
      });
    }
  }, [funcionario]);

  if (!funcionario) return null;

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const setEnd = (k: string, v: any) =>
    setForm((p: any) => ({ ...p, endereco: { ...(p.endereco || {}), [k]: v } }));
  const setMoney = (k: string, raw: string) => set(k, parseCurrencyToNumber(formatCurrencyInput(raw)));
  const moneyVal = (v: any) => (v == null ? "" : formatNumberToCurrency(Number(v)));

  const custoMensal = calcularCustoMensal(form);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: FichaFuncionarioData = {
      id: funcionario.id,
      ...form,
    };
    await update.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ficha do Funcionário — {funcionario.nome}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="pessoal">
            <TabsList className="grid grid-cols-7 w-full">
              <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
              <TabsTrigger value="documentos">Docs</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="contrato">Contrato</TabsTrigger>
              <TabsTrigger value="remuneracao">Remuneração</TabsTrigger>
              <TabsTrigger value="banco">Banco</TabsTrigger>
              <TabsTrigger value="obs">Obs.</TabsTrigger>
            </TabsList>

            {/* PESSOAL */}
            <TabsContent value="pessoal" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={form.nome || ""} onChange={(e) => set("nome", e.target.value)} /></div>
                <div><Label>CPF</Label><Input value={form.cpf || ""} onChange={(e) => set("cpf", e.target.value)} /></div>
                <div><Label>Data de Nascimento</Label><Input type="date" value={form.data_nascimento || ""} onChange={(e) => set("data_nascimento", e.target.value)} /></div>
                <div><Label>Gênero</Label>
                  <Select value={form.genero || ""} onValueChange={(v) => set("genero", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Estado Civil</Label>
                  <Select value={form.estado_civil || ""} onValueChange={(v) => set("estado_civil", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{ESTADO_CIVIL.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Escolaridade</Label>
                  <Select value={form.escolaridade || ""} onValueChange={(v) => set("escolaridade", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{ESCOLARIDADE.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Nacionalidade</Label><Input value={form.nacionalidade || ""} onChange={(e) => set("nacionalidade", e.target.value)} /></div>
                <div><Label>Naturalidade</Label><Input value={form.naturalidade || ""} onChange={(e) => set("naturalidade", e.target.value)} placeholder="Cidade/UF" /></div>
                <div><Label>Nome da Mãe</Label><Input value={form.nome_mae || ""} onChange={(e) => set("nome_mae", e.target.value)} /></div>
                <div><Label>Nome do Pai</Label><Input value={form.nome_pai || ""} onChange={(e) => set("nome_pai", e.target.value)} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone || ""} onChange={(e) => set("telefone", e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
              </div>

              <div className="border-t pt-3 mt-3">
                <h4 className="font-semibold text-sm mb-2">Contato de Emergência</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Nome</Label><Input value={form.contato_emergencia_nome || ""} onChange={(e) => set("contato_emergencia_nome", e.target.value)} /></div>
                  <div><Label>Telefone</Label><Input value={form.contato_emergencia_telefone || ""} onChange={(e) => set("contato_emergencia_telefone", e.target.value)} /></div>
                  <div><Label>Parentesco</Label><Input value={form.contato_emergencia_parentesco || ""} onChange={(e) => set("contato_emergencia_parentesco", e.target.value)} /></div>
                </div>
              </div>
            </TabsContent>

            {/* DOCUMENTOS */}
            <TabsContent value="documentos" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>RG</Label><Input value={form.rg || ""} onChange={(e) => set("rg", e.target.value)} /></div>
                <div><Label>Órgão Emissor</Label><Input value={form.rg_orgao_emissor || ""} onChange={(e) => set("rg_orgao_emissor", e.target.value)} /></div>
                <div><Label>PIS / NIS</Label><Input value={form.pis || ""} onChange={(e) => set("pis", e.target.value)} /></div>
                <div><Label>Título de Eleitor</Label><Input value={form.titulo_eleitor || ""} onChange={(e) => set("titulo_eleitor", e.target.value)} /></div>
                <div><Label>CTPS Número</Label><Input value={form.ctps_numero || ""} onChange={(e) => set("ctps_numero", e.target.value)} /></div>
                <div><Label>CTPS Série</Label><Input value={form.ctps_serie || ""} onChange={(e) => set("ctps_serie", e.target.value)} /></div>
                <div><Label>CTPS UF</Label><Input value={form.ctps_uf || ""} onChange={(e) => set("ctps_uf", e.target.value)} /></div>
                <div></div>
                <div><Label>CNH Número</Label><Input value={form.cnh_numero || ""} onChange={(e) => set("cnh_numero", e.target.value)} /></div>
                <div><Label>CNH Categoria</Label><Input value={form.cnh_categoria || ""} onChange={(e) => set("cnh_categoria", e.target.value)} /></div>
                <div><Label>CNH Validade</Label><Input type="date" value={form.cnh_validade || ""} onChange={(e) => set("cnh_validade", e.target.value)} /></div>
              </div>
            </TabsContent>

            {/* ENDEREÇO */}
            <TabsContent value="endereco" className="space-y-3 pt-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1"><Label>CEP</Label><Input value={form.endereco?.cep || ""} onChange={(e) => setEnd("cep", e.target.value)} /></div>
                <div className="col-span-2"><Label>Logradouro</Label><Input value={form.endereco?.logradouro || ""} onChange={(e) => setEnd("logradouro", e.target.value)} /></div>
                <div><Label>Número</Label><Input value={form.endereco?.numero || ""} onChange={(e) => setEnd("numero", e.target.value)} /></div>
                <div className="col-span-2"><Label>Complemento</Label><Input value={form.endereco?.complemento || ""} onChange={(e) => setEnd("complemento", e.target.value)} /></div>
                <div><Label>Bairro</Label><Input value={form.endereco?.bairro || ""} onChange={(e) => setEnd("bairro", e.target.value)} /></div>
                <div><Label>Cidade</Label><Input value={form.endereco?.cidade || ""} onChange={(e) => setEnd("cidade", e.target.value)} /></div>
                <div><Label>UF</Label><Input maxLength={2} value={form.endereco?.uf || ""} onChange={(e) => setEnd("uf", e.target.value.toUpperCase())} /></div>
              </div>
            </TabsContent>

            {/* CONTRATO */}
            <TabsContent value="contrato" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cargo</Label><Input value={form.cargo || ""} onChange={(e) => set("cargo", e.target.value)} /></div>
                <div><Label>Departamento</Label><Input value={form.departamento || ""} onChange={(e) => set("departamento", e.target.value)} /></div>
                <div><Label>Tipo de Contrato</Label>
                  <Select value={form.tipo_contrato || "CLT"} onValueChange={(v) => set("tipo_contrato", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_CONTRATO.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Regime de Jornada</Label>
                  <Select value={form.regime_jornada || "mensalista"} onValueChange={(v) => set("regime_jornada", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REGIMES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data de Admissão</Label><Input type="date" value={form.data_admissao || ""} onChange={(e) => set("data_admissao", e.target.value)} /></div>
                <div><Label>Data de Demissão</Label><Input type="date" value={form.data_demissao || ""} onChange={(e) => set("data_demissao", e.target.value || null)} /></div>
                <div><Label>Carga Horária Semanal</Label><Input type="number" value={form.carga_horaria || ""} onChange={(e) => set("carga_horaria", Number(e.target.value))} /></div>
              </div>

              <div className="border-t pt-3 mt-3">
                <h4 className="font-semibold text-sm mb-2">Empregador (CNPJ)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Empresa Empregadora</Label>
                    <Select
                      value={form.empregador_cnpj || ""}
                      onValueChange={(v) => {
                        const emp = EMPREGADORES.find(x => x.cnpj === v);
                        set("empregador_cnpj", v);
                        if (emp) set("empregador_nome", emp.nome);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {EMPREGADORES.map(e => <SelectItem key={e.cnpj} value={e.cnpj}>{e.nome} — {e.cnpj}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Código Externo</Label><Input value={form.codigo_externo || ""} onChange={(e) => set("codigo_externo", e.target.value)} /></div>
                  <div><Label>CBO</Label><Input value={form.cbo || ""} onChange={(e) => set("cbo", e.target.value)} /></div>
                  <div><Label>Matrícula INSS</Label><Input value={form.matricula_inss || ""} onChange={(e) => set("matricula_inss", e.target.value)} /></div>
                  <div><Label>Centro de Custo</Label><Input value={form.centro_custo || ""} onChange={(e) => set("centro_custo", e.target.value)} /></div>
                  <div><Label>Filial</Label><Input value={form.filial || ""} onChange={(e) => set("filial", e.target.value)} /></div>
                </div>
              </div>
            </TabsContent>

            {/* REMUNERAÇÃO */}
            <TabsContent value="remuneracao" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Salário Base</Label><CurrencyInput value={moneyVal(form.salario_base)} onChange={(e) => setMoney("salario_base", e.target.value)} /></div>
                <div><Label>Valor Hora</Label><CurrencyInput value={moneyVal(form.valor_hora)} onChange={(e) => setMoney("valor_hora", e.target.value)} /></div>
                <div><Label>Vale Transporte</Label><CurrencyInput value={moneyVal(form.vale_transporte)} onChange={(e) => setMoney("vale_transporte", e.target.value)} /></div>
                <div><Label>Vale Alimentação</Label><CurrencyInput value={moneyVal(form.vale_alimentacao)} onChange={(e) => setMoney("vale_alimentacao", e.target.value)} /></div>
                <div><Label>Vale Refeição</Label><CurrencyInput value={moneyVal(form.vale_refeicao)} onChange={(e) => setMoney("vale_refeicao", e.target.value)} /></div>
                <div><Label>Plano de Saúde</Label><CurrencyInput value={moneyVal(form.plano_saude)} onChange={(e) => setMoney("plano_saude", e.target.value)} /></div>
                <div><Label>Plano Odontológico</Label><CurrencyInput value={moneyVal(form.plano_odontologico)} onChange={(e) => setMoney("plano_odontologico", e.target.value)} /></div>
                <div><Label>Outros Benefícios</Label><CurrencyInput value={moneyVal(form.outros_beneficios)} onChange={(e) => setMoney("outros_beneficios", e.target.value)} /></div>
                <div><Label>Gratificação</Label><CurrencyInput value={moneyVal(form.gratificacao)} onChange={(e) => setMoney("gratificacao", e.target.value)} /></div>
                <div><Label>Comissão (%)</Label><Input type="number" step="0.01" value={form.comissao_percentual || ""} onChange={(e) => set("comissao_percentual", Number(e.target.value))} /></div>
                <div><Label>Insalubridade (%)</Label><Input type="number" step="0.01" value={form.insalubridade_percentual || ""} onChange={(e) => set("insalubridade_percentual", Number(e.target.value))} /></div>
                <div><Label>Desconto VT (%)</Label><Input type="number" step="0.01" value={form.desconto_vt_percentual ?? 6} onChange={(e) => set("desconto_vt_percentual", Number(e.target.value))} /></div>
                <div><Label>Outros Descontos</Label><CurrencyInput value={moneyVal(form.outros_descontos)} onChange={(e) => setMoney("outros_descontos", e.target.value)} /></div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={!!form.periculosidade} onCheckedChange={(v) => set("periculosidade", v)} />
                  <Label>Periculosidade (+30%)</Label>
                </div>
              </div>

              <Card className="p-3 bg-primary/5 mt-2">
                <div className="text-sm text-muted-foreground">Custo mensal estimado para a empresa</div>
                <div className="text-2xl font-bold text-primary">R$ {formatNumberToCurrency(custoMensal)}</div>
                <div className="text-xs text-muted-foreground">(salário + benefícios + ~36% encargos)</div>
              </Card>
            </TabsContent>

            {/* BANCO */}
            <TabsContent value="banco" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Banco</Label><Input value={form.banco_nome || ""} onChange={(e) => set("banco_nome", e.target.value)} /></div>
                <div><Label>Tipo de Conta</Label>
                  <Select value={form.banco_tipo_conta || ""} onValueChange={(v) => set("banco_tipo_conta", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{TIPO_CONTA.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Agência</Label><Input value={form.banco_agencia || ""} onChange={(e) => set("banco_agencia", e.target.value)} /></div>
                <div><Label>Conta</Label><Input value={form.banco_conta || ""} onChange={(e) => set("banco_conta", e.target.value)} /></div>
                <div><Label>Tipo de Chave PIX</Label>
                  <Select value={form.pix_tipo_chave || ""} onValueChange={(v) => set("pix_tipo_chave", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{TIPO_PIX.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Chave PIX</Label><Input value={form.pix_chave || ""} onChange={(e) => set("pix_chave", e.target.value)} /></div>
              </div>
            </TabsContent>

            {/* OBSERVAÇÕES */}
            <TabsContent value="obs" className="space-y-3 pt-3">
              <div>
                <Label>Observações</Label>
                <Textarea rows={8} value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Ficha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
