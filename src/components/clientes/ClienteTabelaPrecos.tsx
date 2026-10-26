import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { parseCurrencyToNumber, formatNumberToCurrency } from "@/lib/currencyUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Plus, Trash2, Loader2, ChevronsUpDown, Check, Search } from "lucide-react";
import { useProdutos, usePrecosEspeciais } from "@/hooks/useProdutos";
import { useClientes, type Cliente } from "@/hooks/useClientes";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";

interface ClienteTabelaPrecosProps {
  clienteId: string | null;
}

interface PrecoEspecialLocal {
  id: string;
  produto_id: string;
  produto_nome: string;
  unidade: string;
  preco_padrao: number;
  preco_especial: number;
  tipo: "acrescido" | "desconto" | "normal";
  isNew?: boolean;
}

export const ClienteTabelaPrecos = ({ clienteId }: ClienteTabelaPrecosProps) => {
  const navigate = useNavigate();
  const { allowed: canManageTerms } = usePermissaoModulo("alterar_condicoes_comerciais");
  const { activeArea } = useWorkspace();
  const {
    produtos,
    isLoading: isLoadingProdutos,
    isError: isProdutosError,
    refetch: refetchProdutos,
  } = useProdutos();
  const {
    clientes,
    isLoading: isLoadingClientes,
    isError: isClientesError,
    refetch: refetchClientes,
    updateCliente,
  } = useClientes();
  const {
    precos: precosEspeciais,
    isLoading: isLoadingPrecos,
    isError: isPrecosError,
    refetch: refetchPrecos,
    upsertPrecoEspecial,
    deletePrecoEspecial,
    copyPrecosEspeciais,
  } = usePrecosEspeciais(clienteId);

  const [precosLocais, setPrecosLocais] = useState<PrecoEspecialLocal[]>([]);
  const [clienteImportar, setClienteImportar] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [produtoSearchOpen, setProdutoSearchOpen] = useState(false);
  const [novoPreco, setNovoPreco] = useState("");
  const produtoRoute = activeArea === "residencial" ? "/residencial/produtos" : "/industrial/produtos";

  // Sincronizar preços do banco com estado local
  useEffect(() => {
    if (precosEspeciais && produtos) {
      const precosFormatados: PrecoEspecialLocal[] = precosEspeciais.map((pe) => {
        const produto = produtos.find((p) => p.id === pe.produto_id);
        const precoNum = pe.preco_especial;
        const precoPadrao = produto?.preco || 0;
        const tipo: PrecoEspecialLocal["tipo"] =
          precoNum > precoPadrao ? "acrescido" : precoNum < precoPadrao ? "desconto" : "normal";
        return {
          id: pe.id,
          produto_id: pe.produto_id,
          produto_nome: produto?.nome || "Produto não encontrado",
          unidade: produto?.unidade || "un",
          preco_padrao: precoPadrao,
          preco_especial: precoNum,
          tipo,
        };
      });
      setPrecosLocais(precosFormatados);
    }
  }, [precosEspeciais, produtos]);

  // Reset when clienteId changes
  useEffect(() => {
    if (!clienteId) {
      setPrecosLocais([]);
    }
  }, [clienteId]);

  // Buscar dados do cliente atual para filtrar por classificação
  const clienteAtual = clientes.find((c) => c.id === clienteId);
  const tabelaPrecoTipo: Cliente["tabela_preco_tipo"] = clienteAtual?.tabela_preco_tipo ?? "padrao";
  const isTabelaPersonalizada = tabelaPrecoTipo === "personalizada";

  const produtosCompativeis = useMemo(() => produtos.filter((p) => {
    if (p.status !== "ativo") return false;
    if (p.unidade_negocio === "ambos" || !p.unidade_negocio) return true;
    if (clienteAtual?.classificacao === "industrial" && p.unidade_negocio === "ID1") return true;
    if (clienteAtual?.classificacao === "residencial" && p.unidade_negocio === "ID2") return true;
    return false;
  }), [clienteAtual?.classificacao, produtos]);

  // Produtos disponíveis (não cadastrados ainda e compatíveis com a classificação do cliente)
  const produtosDisponiveis = produtosCompativeis.filter((p) => {
    // Já está na tabela de preços? Ignora
    if (precosLocais.some((pl) => pl.produto_id === p.id)) return false;
    return true;
  });

  // Outros clientes para importação
  const outrosClientes = clientes.filter(
    (c) => c.id !== clienteId && c.classificacao === clienteAtual?.classificacao,
  );

  const handleImportar = async () => {
    if (!canManageTerms) return;
    if (!clienteImportar || !clienteId) return;

    await copyPrecosEspeciais.mutateAsync(
      { sourceClientId: clienteImportar, targetClientId: clienteId },
      { onSuccess: () => setClienteImportar("") },
    ).catch(() => undefined);
  };

  const handleAdicionarProduto = () => {
    if (!canManageTerms) return;
    if (!clienteId) return;
    if (!produtoSelecionado) {
      navigate(`${produtoRoute}?novo=1`);
      return;
    }

    const produto = produtos.find((p) => p.id === produtoSelecionado);
    if (!produto) return;

    // Usar preço padrão se o campo estiver vazio
    const precoNum = novoPreco ? parseCurrencyToNumber(novoPreco) : produto.preco;
    if (isNaN(precoNum) || precoNum < 0) {
      toast.error("Digite um preço válido.");
      return;
    }

    upsertPrecoEspecial.mutate(
      {
        cliente_id: clienteId,
        produto_id: produto.id,
        preco_especial: precoNum,
        tipo: precoNum > produto.preco ? "acrescido" : precoNum < produto.preco ? "desconto" : "normal",
      },
      {
        onSuccess: () => {
          setProdutoSelecionado("");
          setNovoPreco("");
        },
      }
    );
  };

  const handleUpdatePreco = (id: string, produtoId: string, valor: string) => {
    if (!canManageTerms) return;
    const precoNum = parseCurrencyToNumber(valor);
    if (isNaN(precoNum)) return;

    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto || !clienteId) return;

    upsertPrecoEspecial.mutate({
      cliente_id: clienteId,
      produto_id: produtoId,
      preco_especial: precoNum,
      tipo: precoNum > produto.preco ? "acrescido" : precoNum < produto.preco ? "desconto" : "normal",
    });
  };

  const handleRemover = (id: string) => {
    if (!canManageTerms) return;
    deletePrecoEspecial.mutate(id);
  };

  const getTipoFromPrecos = (precoEspecial: number, precoPadrao: number): "acrescido" | "desconto" | "normal" => {
    if (precoEspecial > precoPadrao) return "acrescido";
    if (precoEspecial < precoPadrao) return "desconto";
    return "normal";
  };

  const handleTabelaPrecoChange = (value: string) => {
    if (!canManageTerms) return;
    if (!clienteId || (value !== "padrao" && value !== "personalizada")) return;
    updateCliente.mutate({ id: clienteId, tabela_preco_tipo: value });
  };

  const isLoading = isLoadingClientes || isLoadingProdutos || (isTabelaPersonalizada && isLoadingPrecos);

  if (!clienteId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>Salve os dados básicos do cliente primeiro para continuar.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando produtos...</span>
      </div>
    );
  }

  if (isClientesError || isProdutosError) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="font-medium">Não foi possível carregar os dados da tabela de preços.</p>
        <p className="text-sm text-muted-foreground">Verifique a conexão e tente novamente.</p>
        <Button
          variant="outline"
          onClick={() => void Promise.all([refetchClientes(), refetchProdutos()])}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (isTabelaPersonalizada && isPrecosError) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="font-medium">Não foi possível carregar a tabela personalizada.</p>
        <p className="text-sm text-muted-foreground">Tente novamente para consultar os preços salvos.</p>
        <Button variant="outline" onClick={() => void refetchPrecos()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {!canManageTerms && <p className="text-sm text-muted-foreground">Consulta permitida. Para alterar preços ou a tabela, solicite a permissão de condições comerciais ao administrador.</p>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg bg-muted/20">
        <div>
          <p className="font-medium">Tabela de preços do cliente</p>
          <p className="text-sm text-muted-foreground">
            {isTabelaPersonalizada
              ? "Defina preços específicos para este cliente."
              : "Os produtos usam os preços padrão cadastrados."}
          </p>
        </div>
        <Select value={tabelaPrecoTipo} onValueChange={handleTabelaPrecoChange} disabled={!canManageTerms || updateCliente.isPending}>
          <SelectTrigger className="w-full sm:w-[220px] bg-background" aria-label="Tipo de tabela de preços">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="padrao">Tabela padrão</SelectItem>
            <SelectItem value="personalizada">Tabela personalizada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isTabelaPersonalizada && canManageTerms && (
        <div className="flex flex-col lg:flex-row gap-4">
        {/* Importar de outro cliente */}
        <div className="flex-1 flex gap-2 items-center p-3 border rounded-lg bg-muted/20">
          <Copy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Select value={clienteImportar} onValueChange={setClienteImportar}>
            <SelectTrigger className="flex-1 bg-background">
              <SelectValue placeholder="Copiar de outro cliente..." />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {outrosClientes.map((cliente) => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleImportar}
            disabled={!clienteImportar || copyPrecosEspeciais.isPending}
          >
            {copyPrecosEspeciais.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Importar"
            )}
          </Button>
        </div>

        {/* Adicionar produto */}
        <div className="flex gap-2 items-center p-3 border rounded-lg bg-muted/20">
          <Popover open={produtoSearchOpen} onOpenChange={setProdutoSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-[300px] justify-between bg-background h-10">
                {produtoSelecionado ? (
                  <span className="truncate text-foreground">
                    {produtos.find(p => p.id === produtoSelecionado)?.nome}
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Search className="w-3.5 h-3.5" />Buscar produto...
                  </span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Digite o nome do produto..." />
                <CommandList>
                  <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                  <CommandGroup>
                    {produtosDisponiveis.map((produto) => (
                      <CommandItem
                        key={produto.id}
                        value={produto.nome}
                        onSelect={() => {
                          setProdutoSelecionado(produto.id);
                          setNovoPreco(formatNumberToCurrency(produto.preco));
                          setProdutoSearchOpen(false);
                        }}
                      >
                        <div className="flex flex-col flex-1">
                          <span className="font-medium">{produto.nome}</span>
                          <span className="text-xs text-muted-foreground">R$ {produto.preco.toFixed(2)} / {produto.unidade}</span>
                        </div>
                        {produtoSelecionado === produto.id && <Check className="ml-auto h-4 w-4" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <CurrencyInput
            className="w-32"
            value={novoPreco}
            onChange={(e) => setNovoPreco(e.target.value)}
          />
          <Button 
            size="icon" 
            onClick={handleAdicionarProduto} 
            disabled={upsertPrecoEspecial.isPending}
            aria-label={produtoSelecionado ? "Adicionar produto à tabela de preços" : "Cadastrar novo produto"}
            title={produtoSelecionado ? "Adicionar produto à tabela de preços" : "Cadastrar novo produto"}
          >
            {upsertPrecoEspecial.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
      )}

      {/* Tabela de Preços */}
      {isTabelaPersonalizada ? (
        <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-primary">Produto</TableHead>
              <TableHead className="font-semibold">Preço Padrão</TableHead>
              <TableHead className="font-semibold">Preço Especial (R$)</TableHead>
              <TableHead className="font-semibold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {precosLocais.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum preço especial cadastrado para este cliente.
                </TableCell>
              </TableRow>
            ) : (
              precosLocais.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.produto_nome}</span>
                    <span className="text-muted-foreground ml-2">({item.unidade})</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    R$ {item.preco_padrao.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CurrencyInput
                        disabled={!canManageTerms}
                        defaultValue={item.preco_especial}
                        onBlur={(e) => handleUpdatePreco(item.id, item.produto_id, e.target.value)}
                        className="w-32"
                      />
                      <StatusBadge
                        variant={
                          getTipoFromPrecos(item.preco_especial, item.preco_padrao) === "acrescido"
                            ? "success"
                            : getTipoFromPrecos(item.preco_especial, item.preco_padrao) === "desconto"
                            ? "danger"
                            : "default"
                        }
                      >
                        {getTipoFromPrecos(item.preco_especial, item.preco_padrao) === "acrescido" && "Acrescido"}
                        {getTipoFromPrecos(item.preco_especial, item.preco_padrao) === "desconto" && "Desconto"}
                        {getTipoFromPrecos(item.preco_especial, item.preco_padrao) === "normal" && "Normal"}
                      </StatusBadge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemover(item.id)}
                        disabled={!canManageTerms || deletePrecoEspecial.isPending}
                      >
                        {deletePrecoEspecial.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-primary">Produto</TableHead>
                <TableHead className="font-semibold">Preço padrão</TableHead>
                <TableHead className="font-semibold">Preço aplicado</TableHead>
                <TableHead className="font-semibold text-right">Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtosCompativeis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum produto padrão disponível para este cliente.
                  </TableCell>
                </TableRow>
              ) : (
                produtosCompativeis.map((produto) => (
                  <TableRow key={produto.id}>
                    <TableCell>
                      <span className="font-medium">{produto.nome}</span>
                      <span className="text-muted-foreground ml-2">({produto.unidade})</span>
                    </TableCell>
                    <TableCell>R$ {produto.preco.toFixed(2)}</TableCell>
                    <TableCell>R$ {produto.preco.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">Preço padrão</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
