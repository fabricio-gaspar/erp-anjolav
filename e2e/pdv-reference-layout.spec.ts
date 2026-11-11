import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";

import { prepareAuthenticatedWorkspace } from "./support";

const clientId = "77777777-7777-4777-8777-777777777777";

async function fulfill(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

test("PDV de balcão mantém o fluxo de ROL e a composição operacional atual", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await prepareAuthenticatedWorkspace(page, {
    isAdmin: false,
    modulePermissions: { caixa: true, faturamento: true, alterar_condicoes_comerciais: true },
    employeeName: "FABRICIO",
    units: [{ id: "44444444-4444-4444-8444-444444444444", code: "MATRIZ", name: "Matriz" }],
  });

  const client = {
    id: clientId,
    tipo_pessoa: "cpf",
    classificacao: "residencial",
    cpf_cnpj: "12345678901",
    razao_social: "FABRICIO GASPAR",
    nome_fantasia: "FABRICIO GASPAR",
    email: "fabricio@example.invalid",
    telefone: "(11) 91234-5678",
    telefone2: null,
    contato: null,
    inscricao_estadual: null,
    inscricao_municipal: null,
    regime_tributario: null,
    observacoes: null,
    tabela_preco_tipo: "personalizada",
    ativo: true,
  };
  const products = [
    { id: "55555555-5555-4555-8555-555555555555", nome: "LENÇOL", descricao: "Lavagem e passagem", codigo: "001", preco: 10, unidade: "peca", status: "ativo", unidade_negocio: "ID2" },
    { id: "66666666-6666-4666-8666-666666666666", nome: "CAMISA SOCIAL", descricao: "Lavagem e passagem", codigo: "015", preco: 8, unidade: "peca", status: "ativo", unidade_negocio: "ID2" },
    { id: "88888888-8888-4888-8888-888888888888", nome: "EDREDOM CASAL", descricao: "Lavagem completa", codigo: "028", preco: 40, unidade: "peca", status: "ativo", unidade_negocio: "ID2" },
  ];

  await page.route("http://127.0.0.1:54321/rest/v1/clientes**", route => fulfill(route, [client]));
  await page.route("http://127.0.0.1:54321/rest/v1/produtos**", route => fulfill(route, products));
  await page.route("http://127.0.0.1:54321/rest/v1/precos_especiais**", route => fulfill(route, products.map((product) => ({
    id: `price-${product.id}`,
    cliente_id: clientId,
    produto_id: product.id,
    preco_especial: product.preco,
    tipo: "normal",
  }))));
  await page.route("http://127.0.0.1:54321/rest/v1/configuracoes_pagamento_cliente**", route => fulfill(route, {
    id: "99999999-9999-4999-8999-999999999999",
    cliente_id: clientId,
    condicao_pagamento: "retirada",
    tipo_faturamento: null,
    forma_pagamento: "dinheiro",
    dia_vencimento: null,
    dia_fechamento: null,
    listar_itens_detalhados: true,
  }));
  await page.route("http://127.0.0.1:54321/rest/v1/enderecos_clientes**", route => fulfill(route, []));
  await page.route("http://127.0.0.1:54321/rest/v1/caixas**", route => fulfill(route, {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    identificador_caixa: "01",
    operador: "FABRICIO",
    status: "ABERTO",
  }));
  await page.route("http://127.0.0.1:54321/functions/v1/pdv-payment", route => fulfill(route, {
    success: true,
    capacity: { configured: true, limit: 20, reserved: 0, available: 20, date: "2026-11-04", area: "residencial" },
  }));

  await page.goto("/residencial/caixa");
  await expect(page.getByTestId("pdv-service-selector")).toBeVisible();
  await page.getByTestId("pdv-service-rol").click();
  await expect(page).toHaveURL(/\/pdv\/domestico\/rol$/);
  await page.getByPlaceholder("Buscar por nome, telefone ou CPF...").fill("FABRICIO");
  await page.getByRole("button", { name: /FABRICIO GASPAR/ }).click();

  for (const product of products) {
    await page.getByPlaceholder("Buscar produto ou serviço (ex.: camisa, calça, lençol...)").fill(product.nome);
    await page.getByRole("button", { name: new RegExp(`${product.nome}.*${product.codigo}`) }).click();
  }
  const itemsTable = page.getByRole("table");
  await itemsTable.getByRole("textbox", { name: "Quantidade de LENÇOL", exact: true }).fill("2");
  await itemsTable.getByRole("textbox", { name: "Quantidade de CAMISA SOCIAL", exact: true }).fill("3");

  await expect(page.getByTestId("pdv-cashier-reference")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Itens da venda" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prazo e capacidade" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumo do ROL" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pagamento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Consultar ROLs" })).toBeVisible();
  await expect(page.getByText("Tabela: Personalizada", { exact: true })).toBeVisible();
  await expect(itemsTable.getByText("LENÇOL", { exact: true })).toBeVisible();
  await expect(page.getByText("Data prometida")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mais Ações" })).toBeVisible();

  const visualRegions = await page.locator(".pdv-cashier-grid").evaluate((grid) => {
    const children = Array.from(grid.children).map((element) => element.getBoundingClientRect());
    return {
      count: children.length,
      sideBySide: children.length === 2 && children[0].right <= children[1].left && children[0].top === children[1].top,
      startsInFirstViewport: children.every((box) => box.top >= 0 && box.top < window.innerHeight),
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    };
  });
  expect(visualRegions.count).toBe(2);
  expect(visualRegions.sideBySide).toBe(true);
  expect(visualRegions.startsInFirstViewport).toBe(true);
  expect(visualRegions.noHorizontalOverflow).toBe(true);

  await page.screenshot({ path: testInfo.outputPath("pdv-reference-current.png") });
});

test("PDV mantém os blocos operacionais sem overflow nas resoluções desktop de suporte", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page, {
    isAdmin: false,
    modulePermissions: { caixa: true, faturamento: true },
  });
  await page.goto("/pdv/domestico/rol");

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByTestId("pdv-cashier-reference")).toBeVisible();

    const geometry = await page.locator(".pdv-cashier-grid").evaluate((grid) => {
      const regions = Array.from(grid.children).map((element) => element.getBoundingClientRect());
      return {
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        regionCount: regions.length,
        sideBySide: regions.length === 2 && regions[0].right <= regions[1].left && regions[0].top === regions[1].top,
        summaryVisible: Boolean(document.querySelector(".pdv-summary-card")),
        paymentVisible: Boolean(document.querySelector(".pdv-payment-card")),
      };
    });

    expect(geometry.pageOverflow, `overflow horizontal em ${viewport.width}px`).toBeLessThanOrEqual(1);
    expect(geometry.regionCount).toBe(2);
    expect(geometry.sideBySide).toBe(true);
    expect(geometry.summaryVisible).toBe(true);
    expect(geometry.paymentVisible).toBe(true);
  }
});
