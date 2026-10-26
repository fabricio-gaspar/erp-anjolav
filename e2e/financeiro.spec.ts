import { expect, test } from "@playwright/test";
import { prepareAuthenticatedWorkspace } from "./support";

test("financeiro apresenta estado de erro recuperável sem consultar ambiente real", async ({ page }) => {
  await prepareAuthenticatedWorkspace(page);
  await page.goto("/central/financeiro");

  await expect(page.getByText("Não foi possível carregar indicadores financeiros.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar novamente" }).first()).toBeVisible();
});
