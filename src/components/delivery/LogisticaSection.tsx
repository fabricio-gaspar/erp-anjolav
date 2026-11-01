import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarIcon, Check, MapPin, Store, Truck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMotoristas } from "@/hooks/useMotoristas";
import { useVeiculos } from "@/hooks/useVeiculos";
import { cn } from "@/lib/utils";
import { MiniMapaEntrega } from "./MiniMapaEntrega";

export interface LogisticaEndereco {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  pais?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface LogisticaSectionProps {
  clienteNome?: string;
  endereco: LogisticaEndereco | null;
  enderecoLoading?: boolean;
  enderecoError?: boolean;
  receiptMode: "balcao" | "coleta";
  onReceiptModeChange: (mode: "balcao" | "coleta") => void;
  deliveryMode: "balcao" | "entrega";
  onDeliveryModeChange: (mode: "balcao" | "entrega") => void;
  dataEntrega: Date;
  onDataEntregaChange: (data: Date) => void;
  motoristaId: string;
  onMotoristaChange: (id: string) => void;
  veiculoId: string;
  onVeiculoChange: (id: string) => void;
  mostrarDataEntrega?: boolean;
}

function ChoiceCard({ active, icon, title, description, onClick }: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-20 items-center justify-between gap-3 rounded-xl border-2 p-3 text-left transition-all",
        active ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <span className="min-w-0">
          <span className="block font-black">{title}</span>
          <span className="block text-xs text-muted-foreground">{description}</span>
        </span>
      </span>
      <span className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
        active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
      )}>
        {active && <Check className="h-4 w-4" />}
      </span>
    </button>
  );
}

export function LogisticaSection({
  clienteNome,
  endereco,
  enderecoLoading = false,
  enderecoError = false,
  receiptMode,
  onReceiptModeChange,
  deliveryMode,
  onDeliveryModeChange,
  dataEntrega,
  onDataEntregaChange,
  motoristaId,
  onMotoristaChange,
  veiculoId,
  onVeiculoChange,
  mostrarDataEntrega = true,
}: LogisticaSectionProps) {
  const { motoristasAtivos } = useMotoristas();
  const { veiculosAtivos } = useVeiculos();
  const requiresRoute = receiptMode === "coleta" || deliveryMode === "entrega";
  const enderecoCompleto = Boolean(endereco?.logradouro?.trim() && endereco?.cidade?.trim() && endereco?.uf?.trim());
  const enderecoFormatado = enderecoCompleto
    ? [
        [endereco?.logradouro, endereco?.numero].filter(Boolean).join(", "),
        endereco?.bairro,
        [endereco?.cidade, endereco?.uf].filter(Boolean).join(" - "),
      ].filter(Boolean).join(" · ")
    : undefined;

  return (
    <section className="space-y-4 rounded-xl border border-strong bg-card p-4" aria-labelledby="pdv-logistica-title">
      <div>
        <h3 id="pdv-logistica-title" className="flex items-center gap-2 text-lg font-black">
          <Truck className="h-5 w-5 text-primary" /> Coleta e entrega
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Defina a chegada e a devolução da roupa. A rota pode ser atribuída depois.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label className="font-black">Como a roupa chega?</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard active={receiptMode === "balcao"} icon={<Store className="h-5 w-5" />} title="No balcão" description="Cliente entrega na loja" onClick={() => onReceiptModeChange("balcao")} />
            <ChoiceCard active={receiptMode === "coleta"} icon={<Truck className="h-5 w-5" />} title="Coletar" description="Buscar no endereço" onClick={() => onReceiptModeChange("coleta")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-black">Como a roupa será devolvida?</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard active={deliveryMode === "balcao"} icon={<Store className="h-5 w-5" />} title="Retirada" description="Cliente retira na loja" onClick={() => onDeliveryModeChange("balcao")} />
            <ChoiceCard active={deliveryMode === "entrega"} icon={<Truck className="h-5 w-5" />} title="Delivery" description="Entregar no endereço" onClick={() => onDeliveryModeChange("entrega")} />
          </div>
        </div>
      </div>

      {requiresRoute && (
        <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:p-4">
          {enderecoLoading ? (
            <p role="status" className="text-sm text-muted-foreground">Carregando o endereço principal do cliente...</p>
          ) : enderecoError ? (
            <div role="alert" className="flex gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Não foi possível consultar o endereço. Tente novamente antes de finalizar.</div>
          ) : !enderecoCompleto ? (
            <div role="alert" className="flex gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />O cliente precisa de endereço principal com logradouro, cidade e UF para coleta ou delivery.</div>
          ) : (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-black"><MapPin className="h-4 w-4 text-primary" /> Endereço da operação</Label>
              <p className="rounded-lg border bg-background px-3 py-2 text-sm font-semibold">{enderecoFormatado}</p>
            </div>
          )}

          {mostrarDataEntrega && deliveryMode === "entrega" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Data de entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataEntrega, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataEntrega} onSelect={(date) => date && onDataEntregaChange(date)} disabled={(date) => date < new Date()} initialFocus locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><User className="h-4 w-4" /> Motorista <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Select value={motoristaId || "none"} onValueChange={(value) => onMotoristaChange(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Atribuir depois" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Atribuir depois</SelectItem>
                  {motoristasAtivos.map((motorista) => <SelectItem key={motorista.id} value={motorista.id}>{motorista.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Truck className="h-4 w-4" /> Veículo <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Select value={veiculoId || "none"} onValueChange={(value) => onVeiculoChange(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Atribuir depois" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Atribuir depois</SelectItem>
                  {veiculosAtivos.map((veiculo) => <SelectItem key={veiculo.id} value={veiculo.id}>{veiculo.placa}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Motorista e veículo podem ser organizados depois em Delivery / Rotas, sem bloquear o atendimento.</p>

          {enderecoCompleto && (
            <MiniMapaEntrega clienteLatitude={endereco?.latitude} clienteLongitude={endereco?.longitude} clienteNome={clienteNome} clienteEndereco={enderecoFormatado} altura="150px" />
          )}
        </div>
      )}
    </section>
  );
}
