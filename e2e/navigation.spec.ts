import { expect, test } from "@playwright/test";
import { prepareAuthenticatedWorkspace } from "./support";

test("login, rota inexistente e portal inválido exibem estados públicos seguros", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar no AnjoLav ERP" })).toBeVisible();
  await expect(page.getByLabel("Login ou e-mail")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Senha", exact: true })).toBeVisible();

  await page.goto("/rota-inexistente");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to Home" })).toBeVisible();

  await page.goto("/portal/codigo-invalido");
  await expect(page.getByRole("heading", { name: "Acesso Negado" })).toBeVisible();
  await expect(page.getByText("O código de acesso informado é inválido ou expirou.")).toBeVisible();
});

test("raiz resolve para a área autorizada usando somente respostas simuladas", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page);
  await page.goto("/");
  await page.waitForURL("**/central");
  await expect(page).toHaveURL(/\/central$/);
});

test("Full Master usa um único seletor de painéis no canto direito", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page, { platformAdmin: true });
  await page.goto("/central");

  await expect(page.getByRole("button", { name: /Trocar painel/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Central", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /Trocar painel/ }).click();
  await expect(page.getByRole("menuitem", { name: "Painel Central" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Painel Industrial" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Painel Residencial" })).toBeVisible();
});

test("Financeiro operacional exibe somente o contexto da própria área", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page);

  await page.goto("/industrial/financeiro");
  await expect(page.getByRole("heading", { name: "Financeiro Industrial", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);

  await page.goto("/residencial/financeiro");
  await expect(page.getByRole("heading", { name: "Financeiro Residencial", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
});

test("usuário somente Residencial não descobre nem acessa outras áreas", async ({ page }) => {
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
  await page.getByRole("button", { name: /Trocar painel/ }).click();
  await expect(page.getByRole("menuitem", { name: "Painel Residencial" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Painel Central" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Painel Industrial" })).toHaveCount(0);

  await page.goto("/industrial/clientes");
  await expect(page.getByRole("heading", { name: "Acesso não autorizado" })).toBeVisible();
});

test("usuário Industrial e usuário com permissões parciais ficam limitados ao escopo concedido", async ({ page }, testInfo) => {
  await prepareAuthenticatedWorkspace(page, {
    accessibleAreas: { central: false, industrial: true, residencial: false },
    isAdmin: false,
    modulePermissions: { dashboard: true, clientes: true },
  });

  await page.goto("/industrial");
  await page.getByRole("button", { name: /Trocar painel/ }).click();
  await expect(page.getByRole("menuitem", { name: "Painel Industrial" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Painel Central" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Painel Residencial" })).toHaveCount(0);
  if (testInfo.project.name === "mobile-chromium") {
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }
  await expect(page.getByText("Clientes", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Financeiro Industrial" })).toHaveCount(0);
});

test("menu mobile abre sem cortar os itens do painel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Executado somente no projeto mobile");
  await prepareAuthenticatedWorkspace(page, { platformAdmin: true });
  await page.goto("/residencial");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("link", { name: "Clientes" })).toBeVisible();
});
