import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Eye, Pencil, Ban, Trash2, Building2, Home } from "lucide-react";
import { ClienteDadosBasicos } from "@/components/clientes/ClienteDadosBasicos";
import { ClienteEndereco } from "@/components/clientes/ClienteEndereco";
import { ClientePagamento } from "@/components/clientes/ClientePagamento";
import { ClienteConfiguracao } from "@/components/clientes/ClienteConfiguracao";
import { ClienteTabelaPrecos } from "@/components/clientes/ClienteTabelaPrecos";
import { toast } from "sonner";

interface Cliente {
  id: string;
  tipo: "industrial" | "residencial";
  nome: string;
  cpfCnpj: string;
  telefone: string;
  cidade: string;
  status: "ativo" | "inativo" | "inadimplente";
}

const mockClientes: Cliente[] = [
  {
    id: "ID1",
    tipo: "industrial",
    nome: "FABRICIO GASPAR",
    cpfCnpj: "276.343.258-13",
    telefone: "(11) 99744-1875",
    cidade: "São Roque",
    status: "ativo",
  },
  {
    id: "ID2",
    tipo: "industrial",
    nome: "GARDEN HOUSE- POUSADA BOUTIQUE & SPA LTDA",
    cpfCnpj: "41.371.209/0001-49",
    telefone: "(11) 3019-4884",
    cidade: "SAO ROQUE",
    status: "ativo",
  },
  {
    id: "ID1",
    tipo: "industrial",
    nome: "Anjolav Servicos de Lavanderia LTDA",
    cpfCnpj: "07.528.955/0001-65",
    telefone: "(11) 4784-1281",
    cidade: "São Roque",
    status: "ativo",
  },
];

const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"todos" | "industrial" | "residencial">("todos");
  const [activeTab, setActiveTab] = useState("lista");

  const filteredClientes = mockClientes.filter((cliente) => {
    const matchesSearch =
      cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cpfCnpj.includes(searchTerm);
    const matchesFilter = filter === "todos" || cliente.tipo === filter;
    return matchesSearch && matchesFilter;
  });

  const handleSaveCliente = () => {
    toast.success("Cliente salvo com sucesso!");
  };

  const handleNovoCliente = () => {
    setActiveTab("dados");
  };

  return (
    <AppLayout title="Clientes">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro de Clientes</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="lista">Lista de Clientes</TabsTrigger>
            <TabsTrigger value="dados">Dados Básicos</TabsTrigger>
            <TabsTrigger value="endereco">Endereço</TabsTrigger>
            <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
            <TabsTrigger value="configuracao">Configuração</TabsTrigger>
            <TabsTrigger value="precos">Tabela de Preços</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="mt-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por nome ou documento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex gap-1">
                  <Button
                    variant={filter === "todos" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("todos")}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={filter === "industrial" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("industrial")}
                    className="gap-1"
                  >
                    <Building2 className="w-3 h-3" />
                    Industrial
                  </Button>
                  <Button
                    variant={filter === "residencial" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("residencial")}
                    className="gap-1"
                  >
                    <Home className="w-3 h-3" />
                    Residencial
                  </Button>
                </div>
              </div>

              <Button className="gap-2" onClick={handleNovoCliente}>
                <Plus className="w-4 h-4" />
                Novo Cliente
              </Button>
            </div>

            <div className="bg-card border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">NOME / RAZÃO SOCIAL</TableHead>
                    <TableHead className="font-semibold">CNPJ</TableHead>
                    <TableHead className="font-semibold">TELEFONE</TableHead>
                    <TableHead className="font-semibold">CIDADE</TableHead>
                    <TableHead className="font-semibold text-right">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClientes.map((cliente, index) => (
                    <TableRow key={index} className="hover:bg-muted/30">
                      <TableCell>
                        <StatusBadge
                          variant={cliente.tipo === "industrial" ? "warning" : "info"}
                        >
                          {cliente.id}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="font-medium">{cliente.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{cliente.cpfCnpj}</TableCell>
                      <TableCell className="text-muted-foreground">{cliente.telefone}</TableCell>
                      <TableCell className="text-muted-foreground">{cliente.cidade}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setActiveTab("dados")}
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Ban className="w-4 h-4 text-warning" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="dados">
            <ClienteDadosBasicos 
              onNext={() => setActiveTab("endereco")} 
              onSave={handleSaveCliente}
            />
          </TabsContent>

          <TabsContent value="endereco">
            <ClienteEndereco 
              onNext={() => setActiveTab("pagamento")} 
              onSave={handleSaveCliente}
            />
          </TabsContent>

          <TabsContent value="pagamento">
            <ClientePagamento 
              onBack={() => setActiveTab("endereco")} 
              onSave={handleSaveCliente}
            />
          </TabsContent>

          <TabsContent value="configuracao">
            <ClienteConfiguracao onSave={handleSaveCliente} />
          </TabsContent>

          <TabsContent value="precos">
            <ClienteTabelaPrecos />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Clientes;
