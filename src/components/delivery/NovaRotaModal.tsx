import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CalendarIcon, 
  Loader2, 
  Truck, 
  User,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMotoristas } from "@/hooks/useMotoristas";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useRotasEntregaMutations } from "@/hooks/useRotasEntrega";

interface NovaRotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (rotaId: string) => void;
}

export function NovaRotaModal({
  open,
  onOpenChange,
  onSuccess,
}: NovaRotaModalProps) {
  const { motoristasAtivos, isLoading: isLoadingMotoristas } = useMotoristas();
  const { veiculosAtivos, isLoading: isLoadingVeiculos } = useVeiculos();
  const { createRota } = useRotasEntregaMutations();

  const [data, setData] = useState<Date>(new Date());
  const [motoristaId, setMotoristaId] = useState<string>("");
  const [veiculoId, setVeiculoId] = useState<string>("");
  const [kmInicial, setKmInicial] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setData(new Date());
      setMotoristaId("");
      setVeiculoId("");
      setKmInicial("");
      setObservacoes("");
    }
  }, [open]);

  const handleSubmit = async () => {
    const result = await createRota.mutateAsync({
      data: format(data, "yyyy-MM-dd"),
      motorista_id: motoristaId || null,
      veiculo_id: veiculoId || null,
      km_inicial: kmInicial ? parseFloat(kmInicial) : null,
      observacoes: observacoes || null,
      status: "pendente",
    });

    onOpenChange(false);
    onSuccess?.(result.id);
  };

  const isLoading = createRota.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Nova Rota de Entrega
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Data */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Data da Rota
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(data, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={data}
                  onSelect={(d) => d && setData(d)}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Motorista */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Motorista
            </Label>
            <Select value={motoristaId} onValueChange={setMotoristaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motorista" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingMotoristas ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    Carregando...
                  </div>
                ) : motoristasAtivos.length === 0 ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    Nenhum motorista ativo
                  </div>
                ) : (
                  motoristasAtivos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Veículo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Veículo
            </Label>
            <Select value={veiculoId} onValueChange={setVeiculoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingVeiculos ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    Carregando...
                  </div>
                ) : veiculosAtivos.length === 0 ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    Nenhum veículo ativo
                  </div>
                ) : (
                  veiculosAtivos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.modelo} - {v.placa}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* KM Inicial */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              KM Inicial (opcional)
            </Label>
            <Input
              type="number"
              value={kmInicial}
              onChange={(e) => setKmInicial(e.target.value)}
              placeholder="Ex: 45230"
            />
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre a rota..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              "Criar Rota"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
