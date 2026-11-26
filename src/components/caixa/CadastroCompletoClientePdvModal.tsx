import { useEffect, useMemo, useState } from "react";
import { Check, FileText, MapPin, Pencil, Search, UserRound, UserPlus } from "lucide-react";

import { ClienteCondicoes } from "@/components/clientes/ClienteCondicoes";
import { ClienteDadosBasicos } from "@/components/clientes/ClienteDadosBasicos";
import { ClienteEndereco } from "@/components/clientes/ClienteEndereco";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Cliente } from "@/hooks/useClientes";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { BrasilApiCnpjResponse } from "@/services/apiServices";

type ClientFormStep = "localizar" | "dados" | "endereco" | "condicoes";

interface CadastroCompletoClientePdvModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectClient: (clientId: string) => void;
  clientes: Cliente[];
  initialSearch: string;
  isLoadingClientes: boolean;
  hasClientesError: boolean;
  onRetryClientes: () => void;
  canCreateClient: boolean;
  canEditClient: boolean;
}

const steps: Array<{ id: ClientFormStep; label: string; icon: typeof UserRound }> = [
  { id: "dados", label: "Dados do cliente", icon: UserRound },
  { id: "endereco", label: "Endereço", icon: MapPin },
  { id: "condicoes", label: "Condições comerciais", icon: FileText },
];

const normalizeSearch = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");

const digitsOnly = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

export function CadastroCompletoClientePdvModal({
  open,
  onOpenChange,
  onSelectClient,
  clientes,
  initialSearch,
  isLoadingClientes,
  hasClientesError,
  onRetryClientes,
  canCreateClient,
  canEditClient,
}: CadastroCompletoClientePdvModalProps) {
  const { activeArea } = useWorkspace();
  const classification = activeArea === "industrial" ? "industrial" : "domestico";
  const [step, setStep] = useState<ClientFormStep>("localizar");
  const [clientId, setClientId] = useState<string | null>(null);
  const [cnpjData, setCnpjData] = useState<BrasilApiCnpjResponse | null>(null);
  const [search, setSearch] = useState("");
  const [editingExisting, setEditingExisting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("localizar");
    setClientId(null);
    setCnpjData(null);
    setSearch(initialSearch);
    setEditingExisting(false);
  }, [classification, initialSearch, open]);

  const finish = (id = clientId) => {
    if (!id) return;
    onOpenChange(false);
    onSelectClient(id);
  };

  const stepIndex = steps.findIndex((item) => item.id === step);
  const matchingClients = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return [];
    const queryDigits = digitsOnly(query);

    return clientes
      .filter((client) => client.ativo)
      .map((client) => {
        const name = client.nome_fantasia || client.razao_social;
        const normalizedName = normalizeSearch(name);
        const textMatches = [normalizedName, normalizeSearch(client.email)].some((value) =>
          value.startsWith(query) || value.split(/\s+/).some((word) => word.startsWith(query)),
        );
        const identityMatches = queryDigits.length > 0 && [client.cpf_cnpj, client.telefone, client.telefone2]
          .some((value) => digitsOnly(value).startsWith(queryDigits));
        if (!textMatches && !identityMatches) return null;

        const exactMatch = [normalizedName, normalizeSearch(client.email)].includes(query)
          || (queryDigits.length > 0 && [client.cpf_cnpj, client.telefone, client.telefone2]
            .some((value) => digitsOnly(value) === queryDigits));
        const rank = exactMatch ? 0 : normalizedName.startsWith(query) ? 1 : 2;
        return { client, name, rank };
      })
      .filter((result): result is { client: Cliente; name: string; rank: number } => result !== null)
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 8);
  }, [clientes, search]);

  const startNewClient = () => {
    setClientId(null);
    setCnpjData(null);
    setEditingExisting(false);
    setStep("dados");
  };

  const editClient = (id: string) => {
    setClientId(id);
    setCnpjData(null);
    setEditingExisting(true);
    setStep("dados");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] max-w-6xl flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 pr-7 text-left">
          <DialogTitle>{step === "localizar" ? "Cliente no atendimento" : editingExisting ? "Editar cliente" : "Cadastrar novo cliente"}</DialogTitle>
          <DialogDescription>
            {step === "localizar"
              ? "Pesquise o cadastro. Se já existir, selecione para este atendimento ou abra para editar."
              : editingExisting
                ? "Atualize os dados do cliente. Ao salvar, ele será selecionado no atendimento."
                : "Cadastre o cliente sem sair do PDV. Ao concluir, ele será selecionado automaticamente no atendimento."}
          </DialogDescription>
        </DialogHeader>

        {step !== "localizar" && <ol className="grid shrink-0 grid-cols-3 gap-2 py-4" aria-label="Etapas do cadastro">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const active = index === stepIndex;
            const complete = index < stepIndex;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={index > stepIndex || (index > 0 && !clientId)}
                  onClick={() => setStep(item.id)}
                  aria-current={active ? "step" : undefined}
                  className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-2 py-2 text-center text-xs font-semibold sm:text-sm ${active ? "border-primary bg-primary/10 text-primary" : complete ? "border-primary/30 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {complete ? <Check className="h-4 w-4 shrink-0" /> : <Icon className="h-4 w-4 shrink-0" />}
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">{index + 1}</span>
                </button>
              </li>
            );
          })}
        </ol>}

        <div className="min-h-0 flex-1 overflow-y-auto px-0.5">
          {step === "localizar" && (
            <section className="space-y-4 py-1" aria-labelledby="pdv-client-lookup-title">
              <div>
                <h3 id="pdv-client-lookup-title" className="text-base font-semibold">Localizar cliente cadastrado</h3>
                <p className="mt-1 text-sm text-muted-foreground">Busque por nome, telefone, CPF/CNPJ ou e-mail nesta operação.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Nome, telefone, CPF/CNPJ ou e-mail..."
                    aria-label="Pesquisar cliente cadastrado"
                    className="pl-9"
                  />
                </div>
                {canCreateClient && <Button type="button" className="h-10 shrink-0 whitespace-nowrap" onClick={startNewClient}>
                  <UserPlus className="mr-2 h-4 w-4" />Cadastrar novo cliente
                </Button>}
              </div>

              {hasClientesError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
                  <p className="font-medium text-foreground">Não foi possível carregar os clientes.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetryClientes}>Tentar novamente</Button>
                </div>
              ) : isLoadingClientes ? (
                <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground" role="status">Carregando clientes desta operação...</p>
              ) : !search.trim() ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Digite para localizar um cliente existente ou cadastre um novo cliente pelo botão ao lado da busca.</p>
              ) : matchingClients.length > 0 ? (
                <div className="space-y-2" aria-label="Resultados da pesquisa de clientes">
                  {matchingClients.map(({ client, name }) => (
                    <article key={client.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{name}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {[client.cpf_cnpj, client.telefone, client.email].filter(Boolean).join(" · ") || "Sem documento ou contato cadastrado"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {canEditClient && <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => editClient(client.id)} aria-label={`Editar cadastro de ${name}`}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar
                        </Button>}
                        <Button type="button" size="sm" className="h-9" onClick={() => finish(client.id)}>
                          <Check className="mr-1.5 h-4 w-4" />Usar no atendimento
                        </Button>
                      </div>
                    </article>
                  ))}
                  <p className="text-xs text-muted-foreground">Mostrando até 8 resultados. Refine a busca para localizar outro cadastro.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-5 text-center">
                  <p className="font-medium text-foreground">Nenhum cliente encontrado nesta operação.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Confira o termo ou use o botão Cadastrar novo cliente ao lado da busca.</p>
                </div>
              )}
            </section>
          )}
          {step === "dados" && (
            <ClienteDadosBasicos
              clienteId={clientId}
              onNext={() => setStep("endereco")}
              onClienteSaved={setClientId}
              onSaved={(id) => editingExisting && finish(id)}
              onOpenExistingClient={(id) => finish(id)}
              onCnpjDataLoaded={setCnpjData}
            />
          )}
          {step === "endereco" && clientId && (
            <ClienteEndereco
              clienteId={clientId}
              cnpjData={cnpjData}
              onNext={() => setStep("condicoes")}
              onSave={() => setStep("condicoes")}
            />
          )}
          {step === "condicoes" && clientId && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                Configure a tabela de preços, os meios de pagamento e as preferências operacionais do cliente. Essas opções podem ser concluídas agora ou depois.
              </div>
              <ClienteCondicoes clienteId={clientId} />
              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setStep("endereco")}>Voltar ao endereço</Button>
                <Button type="button" onClick={() => finish()}>
                  <Check className="mr-2 h-4 w-4" />
                  Selecionar cliente no ROL
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
