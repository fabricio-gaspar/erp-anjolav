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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, Eye, Pencil, Ban, Trash2, Building2, Home, Loader2, User, MoreHorizontal } from "lucide-react";
import { ClienteDadosBasicos } from "@/components/clientes/ClienteDadosBasicos";
import { ClienteEndereco } from "@/components/clientes/ClienteEndereco";
import { ClientePagamento } from "@/components/clientes/ClientePagamento";
import { ClienteConfiguracao } from "@/components/clientes/ClienteConfiguracao";
import { ClienteContrato } from "@/components/clientes/ClienteContrato";
import { ClienteTabelaPrecos } from "@/components/clientes/ClienteTabelaPrecos";
import { useClientes, useClienteById, type Cliente } from "@/hooks/useClientes";
import { useFilteredClientes } from "@/hooks/useFilteredClientes";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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

  const { activeArea } = useWorkspace();
  const { deleteCliente, updateCliente } = useClientes();
  const { data: clientes = [], isLoading } = useFilteredClientes();
  const { data: selectedCliente } = useClienteById(selectedClienteId);

  const filteredClientes = clientes.filter((cliente) => {
    const matchesSearch =
      cliente.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cliente.cpf_cnpj && cliente.cpf_cnpj.includes(searchTerm));
    return matchesSearch;
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

  const pageTitle = activeArea === "industrial" ? "Clientes Industrial" : "Clientes";
  const pageSubtitle = activeArea === "industrial" ? "AnjoLav" : "Gerenciamento de clientes";

  return (
    <AppLayout title={pageTitle} subtitle={pageSubtitle}>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 px-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/80">OPERAÇÃO INDUSTRIAL</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-[1.1]">
            {pageTitle}
          </h1>
          <p className="text-[13px] text-slate-500 font-medium">
            Cadastros exclusivos da operação industrial
          </p>
        </div>

        {activeTab !== "lista" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleBackToList}>
                Voltar para Lista
              </Button>
            </div>

            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                {selectedCliente ? (
                  <Building2 className="h-5 w-5 text-primary" />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground truncate">
                    {selectedCliente?.razao_social || "Novo Cliente"}
                  </h3>
                  {selectedCliente && (
                    <StatusBadge
                      variant={selectedCliente.classificacao === "industrial" ? "warning" : "info"}
                    >
                      {selectedCliente.classificacao === "industrial" ? "Industrial" : "Residencial"}
                    </StatusBadge>
                  )}
                </div>
                {selectedCliente && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {selectedCliente.nome_fantasia && (
                      <span>{selectedCliente.nome_fantasia}</span>
                    )}
                    {selectedCliente.cpf_cnpj && (
                      <span>• {selectedCliente.cpf_cnpj}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="bg-slate-200/50 p-1 rounded-lg inline-flex min-w-max border-none">
              <TabsTrigger value="lista" className="data-[state=active]:bg-[#f5f7fa] data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-3 py-1.5 text-sm font-medium">Lista</TabsTrigger>
              <TabsTrigger value="dados" className="data-[state=active]:bg-[#f5f7fa] data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-3 py-1.5 text-sm font-medium">Dados</TabsTrigger>
              <TabsTrigger value="endereco" disabled={!selectedClienteId} className="data-[state=active]:bg-[#f5f7fa] data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-3 py-1.5 text-sm font-medium">Endereço</TabsTrigger>
              <TabsTrigger value="pagamento" disabled={!selectedClienteId} className="data-[state=active]:bg-[#f5f7fa] data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-3 py-1.5 text-sm font-medium">Pagamento</TabsTrigger>
              <TabsTrigger value="configuracao" disabled={!selectedClienteId} className="data-[state=active]:bg-[#f5f7fa] data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-3 py-1.5 text-sm font-medium">Config.</TabsTrigger>
              <TabsTrigger value="contrato" disabled={!selectedClienteId} className="data-[state=active]:bg-[#f5f7fa] data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-3 py-1.5 text-sm font-medium">Contrato</TabsTrigger>
              <TabsTrigger value="precos" disabled={!selectedClienteId} className="data-[state=active]:bg-[#f5f7fa] data-[state=active]:text-slate-900 data-[state=active]:shadow-sm px-3 py-1.5 text-sm font-medium">Preços</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="lista" className="mt-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white border-[#bccadc] text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button className="gap-2 shrink-0" onClick={handleNovoCliente}>
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Novo Cliente</span>
                </Button>
              </div>
            </div>

            <div className="bg-transparent overflow-x-auto">
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
                    <TableRow className="bg-slate-50 border-none">
                      <TableHead className="font-semibold text-[12px] text-slate-500 py-0.5 px-3">ID</TableHead>
                      <TableHead className="font-semibold text-[12px] text-slate-500 py-0.5 px-3">NOME / RAZÃO SOCIAL</TableHead>
                      <TableHead className="font-semibold text-[12px] text-slate-500 py-0.5 px-3 hidden sm:table-cell">CPF/CNPJ</TableHead>
                      <TableHead className="font-semibold text-[12px] text-slate-500 py-0.5 px-3 hidden md:table-cell">TELEFONE</TableHead>
                      <TableHead className="font-semibold text-[12px] text-slate-500 py-0.5 px-3">STATUS</TableHead>
                      <TableHead className="font-semibold text-[12px] text-slate-500 py-0.5 px-3 text-right">AÇÕES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((cliente) => (
                      <TableRow key={cliente.id} className="hover:bg-muted/30 border-none">
                        <TableCell className="py-2.5 px-3">
                          <StatusBadge
                            variant={cliente.classificacao === "industrial" ? "warning" : "info"}
                          >
                            {getUnidadeNegocioBadge(cliente.classificacao)}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-slate-900">
                          <div>
                            <span className="font-medium">{cliente.razao_social}</span>
                            {cliente.nome_fantasia && (
                              <span className="block text-sm text-muted-foreground">
                                {cliente.nome_fantasia}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-900 hidden sm:table-cell py-2.5 px-3">{cliente.cpf_cnpj || "-"}</TableCell>
                        <TableCell className="text-slate-900 hidden md:table-cell py-2.5 px-3">{cliente.telefone || "-"}</TableCell>
                        <TableCell className="py-2.5 px-3">
                          <StatusBadge variant={cliente.ativo ? "success" : "warning"}>
                            {cliente.ativo ? "Ativo" : "Inativo"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="py-2.5 px-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditCliente(cliente.id)}>
                                <Eye className="w-4 h-4 mr-2" /> Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditCliente(cliente.id)}>
                                <Pencil className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleAtivo(cliente)}>
                                <Ban className="w-4 h-4 mr-2" /> {cliente.ativo ? "Desativar" : "Ativar"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  setClienteToDelete(cliente.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
