import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Plus, Pencil, Trash2, Mail, Key } from "lucide-react";
import { toast } from "sonner";

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  telefone: string;
  cpf: string;
  login: string;
}

const mockFuncionarios: Funcionario[] = [
  { id: "1", nome: "Flavio", cargo: "motorista", departamento: "Logística", telefone: "", cpf: "", login: "flavio" },
  { id: "2", nome: "Jussara", cargo: "Balconista", departamento: "lavanderia", telefone: "", cpf: "", login: "jussara" },
  { id: "3", nome: "ADMIR", cargo: "AUXILIAR", departamento: "lavanderia", telefone: "", cpf: "", login: "admir" },
  { id: "4", nome: "MARCOS", cargo: "motorista", departamento: "Produção", telefone: "", cpf: "", login: "marcos" },
  { id: "5", nome: "JULIA", cargo: "AUXILIAR", departamento: "lavanderia", telefone: "", cpf: "", login: "julia" },
  { id: "6", nome: "ANA", cargo: "COORDENADORA", departamento: "lavanderia", telefone: "", cpf: "", login: "ana" },
];

const cargos = [
  "Operador de Produção",
  "motorista",
  "Balconista",
  "AUXILIAR",
  "COORDENADORA",
  "Gerente",
  "Supervisor",
];

const departamentos = [
  "Produção",
  "Logística",
  "lavanderia",
  "Administração",
  "Comercial",
  "Financeiro",
];

export function ConfiguracoesEquipe() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>(mockFuncionarios);
  const [formData, setFormData] = useState({
    nome: "",
    cargo: "Operador de Produção",
    departamento: "Produção",
    telefone: "",
    cpf: "",
    login: "",
    senha: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim() || !formData.login.trim()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const novoFuncionario: Funcionario = {
      id: Date.now().toString(),
      nome: formData.nome,
      cargo: formData.cargo,
      departamento: formData.departamento,
      telefone: formData.telefone,
      cpf: formData.cpf,
      login: formData.login,
    };

    setFuncionarios([...funcionarios, novoFuncionario]);
    setFormData({
      nome: "",
      cargo: "Operador de Produção",
      departamento: "Produção",
      telefone: "",
      cpf: "",
      login: "",
      senha: "",
    });
    toast.success("Funcionário cadastrado com sucesso!");
  };

  const handleDelete = (id: string) => {
    setFuncionarios(funcionarios.filter((f) => f.id !== id));
    toast.success("Funcionário removido com sucesso!");
  };

  const formatTelefone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return value;
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return value;
  };

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Gestão de Equipe</h2>
            <p className="text-sm text-muted-foreground">
              Cadastre funcionários e defina credenciais de acesso
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Dados Pessoais */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-orange-600 mb-4">Dados Pessoais</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder=""
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo *</Label>
                <Select
                  value={formData.cargo}
                  onValueChange={(value) => setFormData({ ...formData, cargo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cargos.map((cargo) => (
                      <SelectItem key={cargo} value={cargo}>
                        {cargo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select
                  value={formData.departamento}
                  onValueChange={(value) => setFormData({ ...formData, departamento: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentos.map((depto) => (
                      <SelectItem key={depto} value={depto}>
                        {depto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
          </div>

          {/* Credenciais de Acesso */}
          <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-primary mb-1">
              Credenciais de Acesso (Login)
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              O funcionário poderá fazer login usando email OU nome de usuário
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email ou Nome de Usuário *</Label>
                <Input
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  placeholder="usuario@empresa.com ou nome.usuario"
                />
                <p className="text-xs text-primary flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email ou nome de usuário para login (ex: joao.silva)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Senha de Acesso *</Label>
                <Input
                  type="password"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  placeholder="Senha inicial"
                />
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  Senha para primeiro acesso
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="w-4 h-4" />
              Cadastrar Funcionário
            </Button>
          </div>
        </form>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase text-muted-foreground">Nome</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Cargo/Depto</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Login (Email/Usuário)</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {funcionarios.map((funcionario) => (
              <TableRow key={funcionario.id}>
                <TableCell className="font-medium">{funcionario.nome}</TableCell>
                <TableCell className="text-muted-foreground">
                  {funcionario.cargo} / {funcionario.departamento}
                </TableCell>
                <TableCell className="text-primary">{funcionario.login}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleDelete(funcionario.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
