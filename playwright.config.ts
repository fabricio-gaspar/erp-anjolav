import { defineConfig, devices } from "@playwright/test";

const homologUrl = process.env.E2E_HOMOLOG_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: homologUrl || "http://127.0.0.1:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: homologUrl ? undefined : {
    command: "npm run dev -- --host 127.0.0.1 --port 8080",
    url: "http://127.0.0.1:8080/login/pdv",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
