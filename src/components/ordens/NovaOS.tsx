import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const mockClientes = [
  { id: "1", nome: "FABRICIO GASPAR" },
  { id: "2", nome: "HOTEL PLAZA" },
  { id: "3", nome: "RESTAURANTE SABOR" },
];

const mockVeiculos = [
  { id: "1", placa: "ABC-1234", modelo: "Fiorino" },
  { id: "2", placa: "XYZ-5678", modelo: "Sprinter" },
];

export function NovaOS() {
  const [cliente, setCliente] = useState("");
  const [motorista, setMotorista] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [dataRetirada, setDataRetirada] = useState<Date>(new Date());

  const handleSubmit = () => {
    console.log({
      cliente,
      motorista,
      veiculo,
      dataRetirada,
    });
    // TODO: Implement OS creation
  };

  const isFormValid = cliente !== "";

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Retirada - Nova OS</h3>

      <div className="grid grid-cols-2 gap-6">
        {/* Cliente */}
        <div className="space-y-2">
          <Label className="text-primary">
            <span className="text-destructive">*</span> Cliente
          </Label>
          <Select value={cliente} onValueChange={setCliente}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {mockClientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-primary">Vinculado ao cadastro de clientes.</p>
        </div>

        {/* Data da Retirada */}
        <div className="space-y-2">
          <Label>Data da Retirada</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dataRetirada && "text-muted-foreground"
                )}
              >
                {dataRetirada ? (
                  format(dataRetirada, "dd/MM/yyyy", { locale: ptBR })
                ) : (
                  <span>Selecione a data</span>
                )}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataRetirada}
                onSelect={(date) => date && setDataRetirada(date)}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Motorista */}
        <div className="space-y-2">
          <Label>Motorista (Cadastrado)</Label>
          <Select value={motorista} onValueChange={setMotorista}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um motorista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" disabled>
                Nenhum motorista disponível
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-orange-500">
            Nenhum motorista encontrado. Cadastre em "Motoristas".
          </p>
        </div>

        {/* Veículo */}
        <div className="space-y-2">
          <Label>Veículo</Label>
          <Select value={veiculo} onValueChange={setVeiculo}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o veículo" />
            </SelectTrigger>
            <SelectContent>
              {mockVeiculos.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.placa} - {v.modelo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t">
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="bg-primary hover:bg-primary/90"
        >
          Criar OS e Iniciar Fluxo
        </Button>
      </div>
    </div>
  );
}
