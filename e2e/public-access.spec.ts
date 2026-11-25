import { expect, test } from "@playwright/test";

test("os dois painéis exibem o acesso identificado", async ({ page }) => {
  await page.goto("/login/pdv");
  await expect(page.getByRole("heading", { name: "Acesso ao painel do PDV" })).toBeVisible();
  await expect(page.getByLabel("Login ou e-mail")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();

  await page.goto("/login/central");
  await expect(page.getByRole("heading", { name: "Acesso ao painel central" })).toBeVisible();
});

test("as áreas operacionais exigem autenticação", async ({ page }) => {
  await page.goto("/pdv/domestico/rol");
  await expect(page).toHaveURL(/\/login\/pdv/);
  await page.goto("/admin/visao-geral");
  await expect(page).toHaveURL(/\/login\/central/);
});
