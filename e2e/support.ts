import type { Page, Route } from "@playwright/test";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const EMPLOYEE_ID = "33333333-3333-4333-8333-333333333333";
const STORAGE_KEY = "sb-127-auth-token";

function fixtureSession() {
  const payload = Buffer.from(JSON.stringify({ sub: USER_ID, role: "authenticated", exp: 4_102_444_800 })).toString("base64url");
  return {
    access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.fixture-signature`,
    refresh_token: "fixture-refresh-token",
    expires_at: 4_102_444_800,
    expires_in: 3_600,
    token_type: "bearer",
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "e2e@example.invalid",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function prepareAuthenticatedWorkspace(page: Page) {
  await page.addInitScript(({ storageKey, session }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(session));
  }, { storageKey: STORAGE_KEY, session: fixtureSession() });

  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/rest/v1/rpc/get_my_tenant_context")) {
      return fulfillJson(route, {
        activeTenantId: TENANT_ID,
        platformAdmin: false,
        tenants: [{ id: TENANT_ID, name: "Empresa E2E", slug: "empresa-e2e", role: "admin", active: true }],
      });
    }
    if (pathname.endsWith("/rest/v1/funcionarios")) {
      return fulfillJson(route, {
        id: EMPLOYEE_ID,
        nome: "Operador E2E",
        cargo: "Administrador",
        email: "e2e@example.invalid",
        avatar_url: null,
        departamento: null,
      });
    }
    if (pathname.endsWith("/rest/v1/rpc/has_area_access") || pathname.endsWith("/rest/v1/rpc/has_role")) {
      return fulfillJson(route, true);
    }
    if (pathname.endsWith("/rest/v1/rpc/consultar_dashboard_financeiro")) {
      return fulfillJson(route, { message: "Falha simulada para teste visual" }, 500);
    }
    if (pathname.endsWith("/rest/v1/modulo_permissoes") || pathname.endsWith("/rest/v1/configuracoes_gerais")) {
      return fulfillJson(route, []);
    }
    return fulfillJson(route, []);
  });
}
