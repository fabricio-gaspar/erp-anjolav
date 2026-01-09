import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, Clock } from "lucide-react";

interface ClienteConfiguracaoProps {
  onSave: () => void;
}

type Frequencia = "diaria" | "semanal" | "quinzenal" | "mensal";

const diasSemana = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

export const ClienteConfiguracao = ({ onSave }: ClienteConfiguracaoProps) => {
  const [codigoAcesso, setCodigoAcesso] = useState("Não gerado");
  const [linkAcesso, setLinkAcesso] = useState("");
  const [frequencia, setFrequencia] = useState<Frequencia>("semanal");
  const [diasRetirada, setDiasRetirada] = useState<string[]>([]);
  const [diasEntrega, setDiasEntrega] = useState<string[]>([]);
  const [horarioRetirada, setHorarioRetirada] = useState("");
  const [horarioEntrega, setHorarioEntrega] = useState("");

  const handleGerarCodigo = () => {
    const codigo = Math.random().toString(36).substring(2, 10).toUpperCase();
    setCodigoAcesso(codigo);
    setLinkAcesso(`https://portal.anjolav.com.br/${codigo}`);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(linkAcesso);
  };

  const toggleDiaRetirada = (dia: string) => {
    setDiasRetirada((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const toggleDiaEntrega = (dia: string) => {
    setDiasEntrega((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Acesso ao Portal do Cliente */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Acesso ao Portal do Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Código de Acesso</label>
              <div className="flex gap-2">
                <Input
                  value={codigoAcesso}
                  readOnly
                  className="bg-muted/50"
                />
                <Button onClick={handleGerarCodigo}>
                  Gerar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Link de Acesso</label>
              <div className="flex gap-2">
                <Input
                  value={linkAcesso}
                  readOnly
                  className="bg-muted/50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  disabled={!linkAcesso}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Frequência */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Frequência</label>
        <div className="flex gap-0">
          <Button
            type="button"
            variant={frequencia === "diaria" ? "default" : "outline"}
            className={`rounded-r-none ${frequencia === "diaria" ? "" : "border-r-0"}`}
            onClick={() => setFrequencia("diaria")}
          >
            Diária
          </Button>
          <Button
            type="button"
            variant={frequencia === "semanal" ? "default" : "outline"}
            className="rounded-none border-r-0"
            onClick={() => setFrequencia("semanal")}
          >
            Semanal
          </Button>
          <Button
            type="button"
            variant={frequencia === "quinzenal" ? "default" : "outline"}
            className="rounded-none border-r-0"
            onClick={() => setFrequencia("quinzenal")}
          >
            Quinzenal
          </Button>
          <Button
            type="button"
            variant={frequencia === "mensal" ? "default" : "outline"}
            className="rounded-l-none"
            onClick={() => setFrequencia("mensal")}
          >
            Mensal
          </Button>
        </div>
      </div>

      {/* Configuração de Retirada e Entrega */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Retirada */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Configuração de Retirada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-primary font-medium">Dias de Retirada</label>
              <div className="flex gap-1">
                {diasSemana.map((dia) => (
                  <Button
                    key={dia.key}
                    type="button"
                    variant={diasRetirada.includes(dia.key) ? "default" : "outline"}
                    size="sm"
                    className="px-3"
                    onClick={() => toggleDiaRetirada(dia.key)}
                  >
                    {dia.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Horário da Retirada</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="time"
                  placeholder="--:--"
                  value={horarioRetirada}
                  onChange={(e) => setHorarioRetirada(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entrega */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Configuração de Entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-primary font-medium">Dias de Entrega</label>
              <div className="flex gap-1">
                {diasSemana.map((dia) => (
                  <Button
                    key={dia.key}
                    type="button"
                    variant={diasEntrega.includes(dia.key) ? "default" : "outline"}
                    size="sm"
                    className="px-3"
                    onClick={() => toggleDiaEntrega(dia.key)}
                  >
                    {dia.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Horário da Entrega</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="time"
                  placeholder="--:--"
                  value={horarioEntrega}
                  onChange={(e) => setHorarioEntrega(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer Buttons */}
      <div className="flex items-center justify-end pt-4">
        <Button onClick={onSave} className="gap-2">
          <Check className="w-4 h-4" />
          Salvar Cliente
        </Button>
      </div>
    </div>
  );
};
