import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";
import { prepareAuthenticatedWorkspace } from "./support";

const client = {
  id: "77777777-7777-4777-8777-777777777777",
  tipo_pessoa: "cpf",
  classificacao: "residencial",
  cpf_cnpj: "12345678901",
  razao_social: "Cliente PDV E2E",
  nome_fantasia: "Cliente PDV E2E",
  email: "cliente-pdv@example.invalid",
  telefone: "11999999999",
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

const paymentConfig = {
  id: "88888888-8888-4888-8888-888888888888",
  cliente_id: client.id,
  tipo_faturamento: "mensal",
  forma_pagamento: "pix",
  dia_vencimento: 10,
  dia_fechamento: 1,
  condicao_pagamento: null,
  cnpj_emissor_id: null,
  descricao_nf_id: null,
  listar_itens_detalhados: true,
  observacao_faturamento: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

async function fulfill(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

test("PDV permite editar a configuração de pagamento do cliente", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page);
  await page.route("http://127.0.0.1:54321/rest/v1/clientes**", (route) => fulfill(route, [client]));
  await page.route("http://127.0.0.1:54321/rest/v1/configuracoes_pagamento_cliente**", (route) => fulfill(route, [paymentConfig]));

  await page.goto("/residencial/caixa");
  await page.getByPlaceholder("Buscar cliente (nome, CPF/CNPJ, telefone)...").fill("Cliente PDV");
  await page.getByRole("button", { name: /Cliente PDV E2E/ }).click();

  await expect(page.getByRole("button", { name: "Editar pagamento" })).toBeVisible();
  await page.getByRole("button", { name: "Editar pagamento" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Configuração de pagamento do cliente" })).toBeVisible();
  await expect(dialog.getByText("Forma de Pagamento *", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Configurações Fiscais para Faturamento", { exact: true })).toBeVisible();
});
