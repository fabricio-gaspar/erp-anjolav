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
import { Search, Plus, Eye, Pencil, Ban, Trash2, Building2, Home, Loader2 } from "lucide-react";
import { ClienteDadosBasicos } from "@/components/clientes/ClienteDadosBasicos";
import { ClienteEndereco } from "@/components/clientes/ClienteEndereco";
import { ClientePagamento } from "@/components/clientes/ClientePagamento";
import { ClienteConfiguracao } from "@/components/clientes/ClienteConfiguracao";
import { ClienteContrato } from "@/components/clientes/ClienteContrato";
import { ClienteTabelaPrecos } from "@/components/clientes/ClienteTabelaPrecos";
import { useClientes, type Cliente } from "@/hooks/useClientes";
import { BrasilApiCnpjResponse } from "@/services/apiServices";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Clientes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"todos" | "industrial" | "residencial">("todos");
  const [activeTab, setActiveTab] = useState("lista");
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);
  const [cnpjData, setCnpjData] = useState<BrasilApiCnpjResponse | null>(null);

  const { clientes, isLoading, deleteCliente, updateCliente } = useClientes();

  const filteredClientes = clientes.filter((cliente) => {
    const matchesSearch =
      cliente.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cliente.cpf_cnpj && cliente.cpf_cnpj.includes(searchTerm));
    const matchesFilter = filter === "todos" || cliente.classificacao === filter;
    return matchesSearch && matchesFilter;
  });

  const handleNovoCliente = () => {
    setSelectedClienteId(null);
    setCnpjData(null);
    setActiveTab("dados");
  };

  const handleEditCliente = (clienteId: string) => {
    setSelectedClienteId(clienteId);
    setCnpjData(null);
    setActiveTab("dados");
  };

  const handleClienteSaved = (clienteId: string) => {
    setSelectedClienteId(clienteId);
  };

  const handleDeleteCliente = () => {
    if (clienteToDelete) {
      deleteCliente.mutate(clienteToDelete);
      setDeleteDialogOpen(false);
      setClienteToDelete(null);
    }
  };

  const handleToggleAtivo = (cliente: Cliente) => {
    updateCliente.mutate({
      id: cliente.id,
      ativo: !cliente.ativo,
    });
  };

  const handleBackToList = () => {
    setActiveTab("lista");
    setSelectedClienteId(null);
  };

  const getUnidadeNegocioBadge = (classificacao: string) => {
    return classificacao === "industrial" ? "ID1" : "ID2";
  };

  return (
    <AppLayout title="Clientes" subtitle="Gerenciamento de clientes">
      <div className="space-y-2">
        {activeTab !== "lista" && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleBackToList}>
              Voltar para Lista
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted/50 p-1 rounded-lg flex-wrap">
            <TabsTrigger value="lista">Lista de Clientes</TabsTrigger>
            <TabsTrigger value="dados">Dados Básicos</TabsTrigger>
            <TabsTrigger value="endereco" disabled={!selectedClienteId}>Endereço</TabsTrigger>
            <TabsTrigger value="pagamento" disabled={!selectedClienteId}>Pagamento</TabsTrigger>
            <TabsTrigger value="configuracao" disabled={!selectedClienteId}>Configuração</TabsTrigger>
            <TabsTrigger value="contrato" disabled={!selectedClienteId}>Contrato</TabsTrigger>
            <TabsTrigger value="precos" disabled={!selectedClienteId}>Tabela de Preços</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="mt-3">
            <div className="flex items-center justify-between gap-4 mb-3">
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
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Carregando clientes...</span>
                </div>
              ) : filteredClientes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Building2 className="w-12 h-12 mb-4 opacity-50" />
                  <p>Nenhum cliente encontrado</p>
                  <Button variant="link" onClick={handleNovoCliente}>
                    Cadastrar primeiro cliente
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">ID</TableHead>
                      <TableHead className="font-semibold">NOME / RAZÃO SOCIAL</TableHead>
                      <TableHead className="font-semibold">CPF/CNPJ</TableHead>
                      <TableHead className="font-semibold">TELEFONE</TableHead>
                      <TableHead className="font-semibold">STATUS</TableHead>
                      <TableHead className="font-semibold text-right">AÇÕES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((cliente) => (
                      <TableRow key={cliente.id} className="hover:bg-muted/30">
                        <TableCell>
                          <StatusBadge
                            variant={cliente.classificacao === "industrial" ? "warning" : "info"}
                          >
                            {getUnidadeNegocioBadge(cliente.classificacao)}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="font-medium">{cliente.razao_social}</TableCell>
                        <TableCell className="text-muted-foreground">{cliente.cpf_cnpj || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{cliente.telefone || "-"}</TableCell>
                        <TableCell>
                          <StatusBadge variant={cliente.ativo ? "success" : "warning"}>
                            {cliente.ativo ? "Ativo" : "Inativo"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleEditCliente(cliente.id)}
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleEditCliente(cliente.id)}
                            >
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleToggleAtivo(cliente)}
                            >
                              <Ban className={`w-4 h-4 ${cliente.ativo ? "text-warning" : "text-success"}`} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => {
                                setClienteToDelete(cliente.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="dados">
            <ClienteDadosBasicos 
              clienteId={selectedClienteId}
              onNext={() => setActiveTab("endereco")} 
              onClienteSaved={handleClienteSaved}
              onCnpjDataLoaded={setCnpjData}
            />
          </TabsContent>

          <TabsContent value="endereco">
            <ClienteEndereco 
              clienteId={selectedClienteId}
              onNext={() => setActiveTab("pagamento")} 
              onSave={() => setActiveTab("pagamento")}
              cnpjData={cnpjData}
            />
          </TabsContent>

          <TabsContent value="pagamento">
            <ClientePagamento 
              clienteId={selectedClienteId}
              onBack={() => setActiveTab("endereco")} 
              onSave={() => setActiveTab("configuracao")}
            />
          </TabsContent>

          <TabsContent value="configuracao">
            <ClienteConfiguracao 
              clienteId={selectedClienteId}
              onSave={() => setActiveTab("contrato")} 
            />
          </TabsContent>

          <TabsContent value="contrato">
            <ClienteContrato clienteId={selectedClienteId} />
          </TabsContent>

          <TabsContent value="precos">
            <ClienteTabelaPrecos clienteId={selectedClienteId} />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCliente} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Clientes;
