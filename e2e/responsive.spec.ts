import { expect, test } from "@playwright/test";

test("páginas públicas não criam rolagem horizontal em 390 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ["/login", "/rota-inexistente", "/portal/codigo-invalido"]) {
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
