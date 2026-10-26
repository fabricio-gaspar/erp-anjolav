import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { prepareAuthenticatedWorkspace } from "./support";

test.setTimeout(60_000);

type Area = "industrial" | "residencial";
type Condition = "entrada" | "retirada" | "faturado";
const clientId = "77777777-7777-4777-8777-777777777777";
const productId = "55555555-5555-4555-8555-555555555555";

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function preparePdv(page: Page, area: Area, options: {
  condition?: Condition;
  canEdit?: boolean;
  configError?: boolean;
} = {}) {
  await prepareAuthenticatedWorkspace(page, {
    isAdmin: false,
    modulePermissions: { faturamento: true, alterar_condicoes_comerciais: options.canEdit === true },
  });
  const client = {
    id: clientId, tipo_pessoa: "cpf", classificacao: area, cpf_cnpj: "12345678901",
    razao_social: `Cliente PDV ${area}`, nome_fantasia: null, email: "pdv@example.invalid",
    telefone: "11999999999", tabela_preco_tipo: "padrao", ativo: true,
  };
  const product = {
    id: productId, nome: "Lavagem KG", codigo: "111", preco: 10, unidade: "kg",
    status: "ativo", unidade_negocio: area === "industrial" ? "ID1" : "ID2",
  };
  const paymentConfig = {
    id: "88888888-8888-4888-8888-888888888888", cliente_id: clientId,
    condicao_pagamento: options.condition ?? "faturado", tipo_faturamento: "mensal",
    forma_pagamento: options.condition === "entrada" ? "dinheiro" : "boleto",
    dia_vencimento: 10, dia_fechamento: 1, listar_itens_detalhados: true,
  };
  const sales: Array<{ action: string; clientId: string; cashRegisterId: string | null; payment: unknown; items: Array<{ quantidade: number }>; idempotencyKey: string }> = [];
  const loyaltyRequests: string[] = [];
  const directLaunches: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("http://127.0.0.1:54321/rest/v1/clientes**", route => fulfill(route, [
    client,
    { ...client, id: "99999999-9999-4999-8999-999999999999", razao_social: "Cliente outro setor", classificacao: area === "industrial" ? "residencial" : "industrial" },
    { ...client, id: "66666666-6666-4666-8666-666666666666", razao_social: "Cliente inativo", ativo: false },
  ]));
  await page.route("http://127.0.0.1:54321/rest/v1/produtos**", route => fulfill(route, [
    product,
    { ...product, id: "44444444-4444-4444-8444-444444444444", nome: "Produto outro setor", unidade_negocio: area === "industrial" ? "ID2" : "ID1" },
    { ...product, id: "33333333-3333-4333-8333-333333333334", nome: "Camisa peça", codigo: "222", unidade: "peca" },
  ]));
  await page.route("http://127.0.0.1:54321/rest/v1/configuracoes_pagamento_cliente**", route =>
    options.configError ? fulfill(route, { message: "Configuração indisponível" }, 500) : fulfill(route, paymentConfig));
  await page.route("http://127.0.0.1:54321/rest/v1/lancamentos**", route => {
    if (route.request().method() !== "GET") directLaunches.push(route.request().method());
    return fulfill(route, []);
  });
  await page.route("http://127.0.0.1:54321/functions/v1/pdv-payment", route => {
    const body = route.request().postDataJSON();
    if (body.action.includes("loyalty")) loyaltyRequests.push(body.action);
    if (body.action === "create_sale") sales.push(body);
    return fulfill(route, { success: true, order: { id: "12345678-1234-4234-8234-123456789012", number: "OS-123", total: 12.5 }, pix: null });
  });
  return { sales, loyaltyRequests, directLaunches, pageErrors };
}

async function selectClient(page: Page, area: Area) {
  await page.goto(`/${area}/caixa`);
  await page.getByPlaceholder("Buscar cliente (nome, CPF/CNPJ, telefone)...").fill("Cliente");
  await expect(page.getByRole("button", { name: "Cliente outro setor" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cliente inativo" })).toHaveCount(0);
  await page.getByRole("button", { name: new RegExp(`Cliente PDV ${area}`) }).click();
}

async function addKg(page: Page) {
  await page.getByPlaceholder("Digite código ou nome do produto/serviço").fill("Lavagem");
  await page.getByRole("button", { name: /Lavagem KG.*111/ }).click();
}

for (const area of ["industrial", "residencial"] as const) {
  test(`${area}: faturado sem caixa usa o PDV único e não duplica cobrança`, async ({ page }) => {
    const observed = await preparePdv(page, area);
    await selectClient(page, area);
    await expect(page.getByRole("button", { name: "Fechamento", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Histórico de ROLs faturados", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Editar pagamento", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Abrir caixa", exact: true })).toHaveCount(0);
    await addKg(page);
    const quantity = page.getByRole("textbox", { name: "Quantidade de Lavagem KG", exact: true });
    await quantity.fill("0");
    await page.keyboard.press("F4");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await quantity.fill("1000");
    await expect(page.getByRole("button", { name: /Finalizar ROL faturado/ })).toBeDisabled();
    await quantity.fill("1,25");
    await page.keyboard.press("F7");
    await page.keyboard.press("F10");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: /Finalizar ROL faturado/ }).click();
    await page.getByRole("button", { name: "Gerar pendência para fechamento" }).click();
    await expect.poll(() => observed.sales.length).toBe(1);
    expect(observed.sales[0]).toMatchObject({ clientId, cashRegisterId: null, payment: null, items: [{ quantidade: 1.25 }] });
    expect(observed.sales[0].idempotencyKey).toMatch(/^pdv:sale:/);
    expect(observed.directLaunches).toEqual([]);
    expect(observed.loyaltyRequests).toEqual([]);
    expect(observed.pageErrors).toEqual([]);
  });

  test(`${area}: entrada sem caixa bloqueia finalização`, async ({ page }) => {
    const observed = await preparePdv(page, area, { condition: "entrada" });
    await selectClient(page, area);
    await addKg(page);
    await page.getByRole("button", { name: /Finalizar atendimento/ }).click();
    const dialog = page.getByRole("dialog");
    if (area === "industrial") {
      await expect(dialog.getByRole("button", { name: "Pontos", exact: true })).toHaveCount(0);
    }
    await expect(dialog.getByText(/A condição de entrada exige recebimento/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Finalizar Venda", exact: true })).toBeDisabled();
    await page.keyboard.press("F4");
    expect(observed.sales).toHaveLength(0);
    expect(observed.loyaltyRequests).toEqual([]);
  });

  test(`${area}: falha da configuração bloqueia itens e finalização`, async ({ page }) => {
    const observed = await preparePdv(page, area, { configError: true });
    await selectClient(page, area);
    await expect(page.getByText(/Não foi possível carregar clientes, tabela ou condição/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Adicionar item/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Finalizar atendimento/ })).toBeDisabled();
    await page.keyboard.press("F4");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tentar novamente", exact: true })).toBeVisible();
    expect(observed.sales).toHaveLength(0);
  });
}

test("PDV permite editar condições somente com permissão comercial", async ({ page }) => {
  await preparePdv(page, "residencial", { canEdit: true });
  await selectClient(page, "residencial");
  await page.getByRole("button", { name: "Editar pagamento", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Configuração de pagamento do cliente" })).toBeVisible();
  await expect(dialog.getByText("Condição de pagamento", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Método preferido", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Configurações Fiscais para Faturamento", { exact: true })).toBeVisible();
});

test("peças exigem quantidade inteira", async ({ page }) => {
  await preparePdv(page, "industrial");
  await selectClient(page, "industrial");
  await page.getByPlaceholder("Digite código ou nome do produto/serviço").fill("Camisa");
  await page.getByRole("button", { name: /Camisa peça.*222/ }).click();
  const quantity = page.getByRole("textbox", { name: "Quantidade de Camisa peça", exact: true });
  await quantity.fill("1,5");
  await expect(page.getByRole("button", { name: /Finalizar ROL faturado/ })).toBeDisabled();
  await quantity.fill("2");
  await expect(page.getByRole("button", { name: /Finalizar ROL faturado/ })).toBeEnabled();
});

test("PDV mobile mantém ações visíveis sem overflow horizontal da página", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePdv(page, "industrial");
  await selectClient(page, "industrial");
  await addKg(page);
  await expect(page.getByRole("button", { name: "Fechamento", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Histórico de ROLs faturados", exact: true })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    mainWidth: document.querySelector("main")!.scrollWidth,
    mainClientWidth: document.querySelector("main")!.clientWidth,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.mainWidth).toBeLessThanOrEqual(dimensions.mainClientWidth + 1);
});

test("configurações gerais não concedem edição de condições comerciais", async ({ page }) => {
  await preparePdv(page, "residencial");
  await page.route("http://127.0.0.1:54321/rest/v1/modulo_permissoes**", route => fulfill(route, [
    { modulo_key: "faturamento", tem_acesso: true },
    { modulo_key: "configuracoes", tem_acesso: true },
  ]));
  await selectClient(page, "residencial");
  await expect(page.getByRole("button", { name: "Editar pagamento", exact: true })).toHaveCount(0);
});

for (const alias of ["/pdv", "/caixa"]) {
  for (const area of ["industrial", "residencial"] as const) {
    test(`${alias}: escolhe o PDV ${area} autorizado, sem cair no dashboard`, async ({ page }) => {
      await prepareAuthenticatedWorkspace(page, {
        isAdmin: false,
        accessibleAreas: { industrial: area === "industrial", residencial: area === "residencial" },
        modulePermissions: { faturamento: true, dashboard: true },
      });
      await page.goto(alias);
      await expect(page).toHaveURL(new RegExp(`/${area}/caixa$`));
      await expect(page.getByPlaceholder("Buscar cliente (nome, CPF/CNPJ, telefone)...")).toBeVisible();
    });
  }
  test(`${alias}: não redireciona ao dashboard quando nenhum PDV é autorizado`, async ({ page }) => {
    await prepareAuthenticatedWorkspace(page, { isAdmin: false, modulePermissions: { dashboard: true } });
    await page.goto(alias);
    await expect(page.getByRole("alert").getByText("Sua conta não possui acesso ao PDV de atendimento em nenhum setor.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${alias}$`));
  });
}
