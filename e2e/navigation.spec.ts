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
