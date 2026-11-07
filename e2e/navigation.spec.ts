import { expect, test } from "@playwright/test";
import { prepareAuthenticatedWorkspace } from "./support";

test("login, rota inexistente e portal inválido exibem estados públicos seguros", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar no AnjoLav ERP" })).toBeVisible();
  await expect(page.getByLabel("Login ou e-mail")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Senha", exact: true })).toBeVisible();

  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "Recupere seu acesso" })).toBeVisible();
  await expect(page.getByLabel("E-mail da conta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar link de recuperação" })).toBeDisabled();

  await page.goto("/rota-inexistente");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to Home" })).toBeVisible();

  await page.goto("/portal/codigo-invalido");
  await expect(page.getByRole("heading", { name: "Acesso Negado" })).toBeVisible();
  await expect(page.getByText("O código de acesso informado é inválido ou expirou.")).toBeVisible();
});

test("raiz resolve administrador para o painel canônico usando somente respostas simuladas", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page);
  await page.goto("/");
  await page.waitForURL("**/admin/visao-geral");
  await expect(page).toHaveURL(/\/admin\/visao-geral$/);
});

test("painel administrativo mantém operação e período reproduzíveis pela URL", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page);
  await page.goto("/admin/visao-geral?operacao=industrial&periodo=7d");

  await expect(page.getByLabel("Operação")).toHaveValue("industrial");
  await expect(page.getByLabel("Período")).toHaveValue("7d");
  await expect(page.getByRole("main")).toBeVisible();
});

test("operador com caixa entra na frente operacional antes de abrir a venda", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page, {
    isAdmin: false,
    accessibleAreas: { central: true, industrial: false, residencial: true },
    modulePermissions: { dashboard: true, caixa: true },
  });
  await page.goto("/");
  await page.waitForURL("**/pdv/painel/domestico");
  await expect(page).toHaveURL(/\/pdv\/painel\/domestico$/);
  await expect(page.getByTestId("pdv-front-office")).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir Balcão / PDV" })).toBeVisible();
});

test("frente operacional leva ao caixa sem expor administração", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page, {
    isAdmin: false,
    accessibleAreas: { central: false, industrial: false, residencial: true },
    modulePermissions: { caixa: true, faturamento: true, clientes: true, agenda: true, ordens: true, producao: true, relatorios: true },
  });
  await page.goto("/pdv/painel/domestico");

  await expect(page.getByRole("heading", { name: "Painel principal", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir Administração" })).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir Balcão / PDV" }).click();
  await expect(page).toHaveURL(/\/pdv\/domestico$/);
});

test("subrotas operacionais mantêm a casca do PDV", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page);
  await page.goto("/pdv/domestico/clientes");

  await expect(page.getByText("Voltar ao painel principal", { exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="AnjoLav"]')).toBeVisible();
  await expect(page.getByLabel("Contexto operacional")).toBeVisible();
});

test("painel administrativo concentra a navegação e o contexto global", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page, { platformAdmin: true });
  await page.goto("/admin/visao-geral");

  await expect(page.getByLabel("Operação")).toBeVisible();
  await expect(page.getByLabel("Unidade")).toBeVisible();
  await expect(page.getByLabel("Período")).toBeVisible();
  await expect(page.getByRole("link", { name: "PDV e caixas" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Trocar painel/ })).toHaveCount(0);
});

test("Financeiro operacional exibe somente o contexto da própria área", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page);

  for (const area of [{ route: "industrial", label: "Industrial" }, { route: "residencial", label: "Doméstico" }] as const) {
    await page.goto(`/${area.route}/financeiro`);
    await expect(page.getByRole("heading", { name: `Financeiro ${area.label}`, exact: true }).first()).toBeVisible();

    await expect(page.getByRole("tab", { name: "Resumo", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "A receber", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Conciliação", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Faturamento", exact: true })).toBeVisible();

    await expect(page.getByRole("tab", { name: "A pagar", exact: true })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Todos", exact: true })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Industrial", exact: true })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Doméstico", exact: true })).toHaveCount(0);
  }
});

test("usuário somente Doméstico não descobre nem acessa outras áreas", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page, {
    accessibleAreas: { central: false, industrial: false, residencial: true },
    isAdmin: false,
    modulePermissions: {
      dashboard: true,
      clientes: true,
      caixa: true,
      agenda: true,
      ordens: true,
      producao: true,
      faturamento: true,
      produtos: true,
      relatorios: true,
    },
  });

  await page.goto("/residencial");
  await expect(page.getByRole("button", { name: "Balcão PDV" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Olá,|Painel principal/ })).toBeVisible();
  await expect(page.getByLabel("Contexto operacional")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).toHaveCount(0);
  await expect(page.getByText("Central de Controle", { exact: true })).toHaveCount(0);

  await page.goto("/industrial/clientes");
  await expect(page.getByRole("heading", { name: "Acesso não autorizado" })).toBeVisible();
});

test("usuário Industrial e usuário com permissões parciais ficam limitados ao escopo concedido", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page, {
    accessibleAreas: { central: false, industrial: true, residencial: false },
    isAdmin: false,
    modulePermissions: { dashboard: true, clientes: true },
  });

  await page.goto("/industrial");
  await expect(page.getByRole("button", { name: "Clientes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Balcão PDV" })).toHaveCount(0);
  await expect(page.getByLabel("Contexto operacional")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).toHaveCount(0);
  await expect(page.getByText("Central de Controle", { exact: true })).toHaveCount(0);
});

test("PDV usa URL e ambiente operacional separados do painel administrativo", async ({ page }, testInfo) => {
  await prepareAuthenticatedWorkspace(page);
  await page.goto("/residencial/caixa");

  await expect(page).toHaveURL(/\/pdv\/domestico$/);
  await expect(page.getByRole("heading", { name: "PDV / Caixa", exact: true })).toBeVisible();
  await expect(page.getByText("Carregando contexto do atendimento...")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Meu dia" })).toHaveCount(0);
  await expect(page.getByLabel("Contexto operacional")).toBeVisible();
  const unit = page.getByText("Unidade E2E", { exact: true });
  if (testInfo.project.name === "mobile-chromium") {
    await expect(unit).toHaveCount(1);
  } else {
    await expect(unit).toBeVisible();
  }
  await expect(page.getByText("Central de Controle", { exact: true })).toHaveCount(0);
});

test("portal operacional mobile mantém o contexto sem menu administrativo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Executado somente no projeto mobile");
  await prepareAuthenticatedWorkspace(page, { platformAdmin: true });
  await page.goto("/residencial");
  await expect(page.getByLabel("Contexto operacional")).toBeVisible();
  await expect(page.getByRole("button", { name: "Balcão PDV" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).toHaveCount(0);
});
