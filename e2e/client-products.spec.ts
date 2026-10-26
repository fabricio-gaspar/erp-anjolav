import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";
import { prepareAuthenticatedWorkspace } from "./support";

const client = {
  id: "44444444-4444-4444-8444-444444444444",
  tipo_pessoa: "cpf",
  classificacao: "residencial",
  cpf_cnpj: "12345678901",
  razao_social: "Cliente Residencial E2E",
  nome_fantasia: "Cliente E2E",
  email: "cliente@example.invalid",
  telefone: null,
  telefone2: null,
  contato: null,
  inscricao_estadual: null,
  inscricao_municipal: null,
  regime_tributario: null,
  observacoes: null,
  tabela_preco_tipo: "padrao",
  ativo: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function product(id: string, nome: string, porte: "pequeno" | "medio" | "grande" | null) {
  return {
    id,
    codigo: null,
    nome,
    descricao: null,
    preco: 12.5,
    unidade: "peca",
    unidade_negocio: "ID2",
    categoria: "roupas",
    porte,
    status: "ativo",
    peso_medio_kg: null,
    tempo_processo_min: 30,
    processo_lavagem: "normal",
    temperatura_maxima: 60,
    requer_secadora: true,
    cor: "branco",
    composicao: "algodao",
    instrucoes_especiais: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

test("cliente abre os dados pelo nome e exibe a tabela padrão", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page);
  await page.route("http://127.0.0.1:54321/rest/v1/clientes**", (route) => fulfill(route, [client]));
  await page.route("http://127.0.0.1:54321/rest/v1/produtos**", (route) => fulfill(route, [product("55555555-5555-4555-8555-555555555555", "Lavagem padrão E2E", "medio")]));
  await page.route("http://127.0.0.1:54321/rest/v1/precos_especiais**", (route) => fulfill(route, []));

  await page.goto("/residencial/clientes");
  await expect(page.getByRole("main").getByRole("heading", { name: "Clientes Residencial" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir cliente Cliente Residencial E2E" }).click();
  await expect(page.getByRole("heading", { name: "Cliente Residencial E2E" })).toBeVisible();

  await page.getByRole("tab", { name: "Preços" }).click();
  await expect(page.getByText("Tabela de preços do cliente")).toBeVisible();
  await expect(page.getByText("Lavagem padrão E2E")).toBeVisible();
  await expect(page.getByText("Preço padrão", { exact: true }).last()).toBeVisible();
});

test("produto permite selecionar porte e salvar o item na listagem", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page);
  const products = [product("55555555-5555-4555-8555-555555555555", "Lavagem existente E2E", "pequeno")];

  await page.route("http://127.0.0.1:54321/rest/v1/produtos**", async (route) => {
    if (route.request().method() === "POST") {
      const payload = JSON.parse(route.request().postData() ?? "{}");
      const created = product("66666666-6666-4666-8666-666666666666", payload.nome, payload.porte ?? null);
      products.push({ ...created, ...payload });
      return fulfill(route, [products.at(-1)]);
    }
    return fulfill(route, products);
  });

  await page.goto("/residencial/produtos");
  await expect(page.getByText("Lavagem existente E2E")).toBeVisible();
  await page.getByRole("button", { name: "Novo Produto" }).click();
  await page.getByPlaceholder("EX: LENÇOL SOLTEIRO").fill("Toalha nova E2E");

  await page.getByText("Não informado", { exact: true }).first().click();
  await page.getByRole("option", { name: "Grande" }).click();
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(page.getByText("Produto criado com sucesso!")).toBeVisible();
  await expect(page.getByText("Toalha nova E2E")).toBeVisible();
  await expect(page.getByText("Porte: Grande")).toBeVisible();
});
