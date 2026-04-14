import { useState, useEffect } from "react";
import { format, addDays, isWeekend, nextMonday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  Truck, 
  Store, 
  CalendarIcon, 
  User,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMotoristas } from "@/hooks/useMotoristas";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MiniMapaEntrega } from "./MiniMapaEntrega";

interface LogisticaSectionProps {
  clienteId: string | null;
  tipoLogistica: "buscar" | "entregar";
  onTipoChange: (tipo: "buscar" | "entregar") => void;
  dataEntrega: Date;
  onDataEntregaChange: (data: Date) => void;
  motoristaId: string;
  onMotoristaChange: (id: string) => void;
  veiculoId: string;
  onVeiculoChange: (id: string) => void;
}

export function LogisticaSection({
  clienteId,
  tipoLogistica,
  onTipoChange,
  dataEntrega,
  onDataEntregaChange,
  motoristaId,
  onMotoristaChange,
  veiculoId,
  onVeiculoChange,
}: LogisticaSectionProps) {
  const { motoristasAtivos } = useMotoristas();
  const { veiculosAtivos } = useVeiculos();

  // Buscar endereço do cliente
  const { data: enderecoCliente } = useQuery({
    queryKey: ["endereco_cliente", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("enderecos_clientes")
        .select("*")
        .eq("cliente_id", clienteId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!clienteId,
  });

  // Buscar nome do cliente
  const { data: cliente } = useQuery({
    queryKey: ["cliente_nome", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("clientes")
        .select("razao_social, nome_fantasia")
        .eq("id", clienteId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!clienteId,
  });

  const enderecoFormatado = enderecoCliente
    ? `${enderecoCliente.logradouro || ""}, ${enderecoCliente.numero || ""} - ${enderecoCliente.bairro || ""}, ${enderecoCliente.cidade || ""}`
    : undefined;

  return (
    <div className="space-y-4">
      {/* Tipo de Logística */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Truck className="w-4 h-4" />
          Logística de Entrega
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onTipoChange("buscar")}
            className={cn(
              "p-4 rounded-lg border-2 text-center transition-all",
              tipoLogistica === "buscar"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/30"
            )}
          >
            <Store className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="font-semibold text-sm">Retirada no Local</p>
            <p className="text-xs text-muted-foreground">Cliente retira na loja</p>
          </button>
          <button
            type="button"
            onClick={() => onTipoChange("entregar")}
            className={cn(
              "p-4 rounded-lg border-2 text-center transition-all",
              tipoLogistica === "entregar"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/30"
            )}
          >
            <Truck className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="font-semibold text-sm">Entregar</p>
            <p className="text-xs text-muted-foreground">Enviar ao cliente</p>
          </button>
        </div>
      </div>

      {/* Campos adicionais quando entregar */}
      {tipoLogistica === "entregar" && (
        <>
          {/* Data de Entrega */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Data de Entrega
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataEntrega, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataEntrega}
                  onSelect={(d) => d && onDataEntregaChange(d)}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Motorista e Veículo em linha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Motorista
              </Label>
              <Select value={motoristaId || "none"} onValueChange={(val) => onMotoristaChange(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {motoristasAtivos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Veículo
              </Label>
              <Select value={veiculoId || "none"} onValueChange={(val) => onVeiculoChange(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {veiculosAtivos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mini Mapa */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Localização do Cliente
            </Label>
            <MiniMapaEntrega
              clienteLatitude={enderecoCliente?.latitude}
              clienteLongitude={enderecoCliente?.longitude}
              clienteNome={cliente?.nome_fantasia || cliente?.razao_social}
              clienteEndereco={enderecoFormatado}
              altura="150px"
            />
          </div>
        </>
      )}
    </div>
  );
}
