import { expect, test, type Page } from "@playwright/test";

const homologUrl = process.env.E2E_HOMOLOG_URL;
const operatorLogin = process.env.E2E_PDV_OPERATOR_LOGIN;
const operatorPassword = process.env.E2E_PDV_OPERATOR_PASSWORD;
const adminLogin = process.env.E2E_CENTRAL_ADMIN_LOGIN;
const adminPassword = process.env.E2E_CENTRAL_ADMIN_PASSWORD;
const activeRolNumber = process.env.E2E_ACTIVE_ROL_NUMBER;

test.describe("jornada de homologação com usuários fictícios", () => {
  test.skip(!homologUrl || !operatorLogin || !operatorPassword || !adminLogin || !adminPassword,
    "Exige URL de homologação e credenciais fictícias separadas da produção");

  async function login(page: Page, path: string, user: string, password: string) {
    await page.goto(path);
    await page.getByLabel("Login ou e-mail").fill(user);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page).not.toHaveURL(/\/login(?:\/|$)/);
  }

  test("operador acessa o PDV e não entra no painel central", async ({ page }) => {
    await login(page, "/login/pdv", operatorLogin!, operatorPassword!);
    await expect(page).toHaveURL(/\/(pdv|residencial|industrial)/);
    await page.goto("/admin/visao-geral");
    await expect(page).not.toHaveURL(/\/admin\/visao-geral$/);
  });

  test("administrador consulta as áreas autorizadas", async ({ page }) => {
    await login(page, "/login/central", adminLogin!, adminPassword!);
    await expect(page).toHaveURL(/\/admin\//);
    await page.goto("/pdv/painel");
    await expect(page).toHaveURL(/\/(pdv|residencial|industrial)/);
  });

  test("ROL ativo abre com itens, anexos, edição operacional e impressão", async ({ page }) => {
    test.skip(!activeRolNumber, "Exige o número de um ROL fictício ativo em homologação");
    await login(page, "/login/pdv", operatorLogin!, operatorPassword!);
    await page.goto("/pdv/domestico/ordens");
    await page.getByRole("textbox", { name: "Pesquisar pelo número do pedido ou ROL" })
      .fill(activeRolNumber!);
    await page.getByRole("button", { name: `Abrir ROL ${activeRolNumber}` }).click();
    await expect(page.getByRole("heading", { name: `ROL ${activeRolNumber}` })).toBeVisible();
    await expect(page.getByText("Itens do pedido")).toBeVisible();
    await expect(page.getByText("Carregando anexos...")).toHaveCount(0);
    await expect(page.getByText("Não foi possível consultar os anexos")).toHaveCount(0);

    await page.getByRole("button", { name: "Imprimir" }).click();
    await page.getByRole("menuitem", { name: "Opções de Impressão..." }).click();
    const printDialog = page.getByRole("dialog", { name: "Imprimir ROL" });
    await expect(printDialog.getByRole("radio", { name: /Recibo \(ROL\)/ })).toBeChecked();
    await printDialog.getByRole("button", { name: "Cancelar" }).click();

    await page.getByRole("button", { name: /Avançar para/ }).click();
    const stageDialog = page.getByRole("dialog");
    await expect(stageDialog.getByRole("button", { name: "Confirmar Avanço" })).toBeVisible();
    await stageDialog.getByRole("button", { name: "Cancelar" }).click();
  });

  test("Estoque e Compras consultam dados e locais sem falha", async ({ page }) => {
    await login(page, "/login/central", adminLogin!, adminPassword!);
    await page.goto("/pdv/domestico/estoque");
    await expect(page.getByRole("heading", { name: "Estoque e Compras" })).toBeVisible();
    for (const name of ["Insumos", "Compras", "Locais e saldos", "Movimentações"]) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("tab", { name })).toHaveAttribute("data-state", "active");
      await expect(page.getByText(/Não foi possível (consultar|carregar)/)).toHaveCount(0);
    }
  });
});
