import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

test("Clientes distingue o painel central da operação do cliente", () => {
  const page = source("../src/pages/Clientes.tsx");
  const form = source("../src/components/clientes/ClienteDadosBasicos.tsx");

  assert.match(page, /activeArea === "residencial"/);
  assert.match(page, /Clientes \$\{areaLabel\}/);
  assert.match(page, /activeArea === "central" \? "Clientes"/);
  assert.match(page, /Clientes da empresa nas operações doméstica e industrial/);
  assert.doesNotMatch(page, /const pageTitle = "Clientes Industrial"/);
  assert.doesNotMatch(page, />Somente Industrial<\/span>/);
  assert.match(form, /const \{ activeArea \} = useWorkspace\(\);/);
  assert.match(form, /setClassificationConfirmed\(activeArea !== "central"\)/);
  assert.match(form, /Escolha a operação responsável pelo cliente antes de salvar/);
  assert.match(form, /effectiveClassification/);
});

test("consulta de CEP aproveita coordenadas do provedor e informa localização aproximada", () => {
  const api = source("../src/services/apiServices.ts");
  const address = source("../src/components/clientes/ClienteEndereco.tsx");

  assert.match(api, /api\/cep\/v2/);
  assert.match(api, /latitude: number/);
  assert.match(api, /longitude: number/);
  assert.match(address, /latitude: result\.latitude \?\? null/);
  assert.match(address, /longitude: result\.longitude \?\? null/);
  assert.match(address, /Localização aproximada pelo CEP/);
  assert.match(address, /não bloqueia o cadastro quando indisponível/);
});

test("mapa de endereços não usa os tiles públicos que estão bloqueando a aplicação", () => {
  const map = source("../src/components/ui/AddressMap.tsx");
  const baseLayer = source("../src/components/ui/MapBaseLayer.tsx");
  const tiles = source("../src/lib/mapTiles.ts");

  assert.match(map, /MapBaseLayer/);
  assert.match(baseLayer, /maplibreGL/);
  assert.match(tiles, /tiles\.openfreemap\.org\/styles\/bright/);
  assert.match(tiles, /VITE_MAP_TILE_URL/);
  assert.doesNotMatch(tiles, /tile\.openstreetmap\.org|basemaps\.cartocdn\.com/);
});

test("botão de adicionar preço abre o cadastro compartilhado de produtos quando não há produto selecionado", () => {
  const prices = source("../src/components/clientes/ClienteTabelaPrecos.tsx");
  const products = source("../src/pages/Produtos.tsx");

  assert.match(prices, /useNavigate/);
  assert.match(prices, /novo=1/);
  assert.match(prices, /if \(!produtoSelecionado\) \{\s*navigate/);
  assert.match(prices, /disabled=\{upsertPrecoEspecial\.isPending\}/);
  assert.doesNotMatch(prices, /disabled=\{!produtoSelecionado/);
  assert.match(products, /useSearchParams/);
  assert.match(products, /searchParams\.get\("novo"\) === "1"/);
});

test("tabela de preços separa modo padrão e personalizada e trata falha recuperável", () => {
  const prices = source("../src/components/clientes/ClienteTabelaPrecos.tsx");

  assert.match(prices, /tabela_preco_tipo/);
  assert.match(prices, /personalizada/);
  assert.match(prices, /produto\.preco/);
  assert.match(prices, /isError/);
  assert.match(prices, /Tentar novamente/);
});

test("clientes abre os dados ao clicar no nome e produtos persistem a classificação de porte", () => {
  const clients = source("../src/pages/Clientes.tsx");
  const productForm = source("../src/components/produtos/ProdutoForm.tsx");
  const products = source("../src/pages/Produtos.tsx");
  const productCard = source("../src/components/produtos/ProdutoCard.tsx");

  assert.match(clients, /onClick=\{\(\) => handleEditCliente\(cliente\.id\)\}/);
  assert.match(clients, /aria-label=\{`Abrir cliente/);
  assert.match(productForm, /porte:.*pequeno.*medio.*grande/);
  assert.match(productForm, /Pequeno/);
  assert.match(productForm, /Médio/);
  assert.match(productForm, /Grande/);
  assert.match(products, /porte: formData\.porte \|\| null/);
  assert.match(products, /porte: produto\.porte \|\| ""/);
  assert.match(productCard, /produto\.porte/);
});
