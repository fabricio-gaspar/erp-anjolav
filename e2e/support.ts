import type { Page, Route } from "@playwright/test";

type WorkspaceArea = "central" | "industrial" | "residencial";

interface WorkspaceFixtureOptions {
  accessibleAreas?: Partial<Record<WorkspaceArea, boolean>>;
  isAdmin?: boolean;
  platformAdmin?: boolean;
  accessMode?: "admin" | "pdv" | "hybrid";
  operations?: Array<"industrial" | "domestico">;
  units?: Array<{ id: string; code: string; name: string }>;
  employeeName?: string;
  modulePermissions?: Record<string, boolean>;
  mfaRequired?: boolean;
  aal?: "aal1" | "aal2";
  mfaFactors?: Array<{
    id: string;
    factor_type: "totp";
    status: "verified" | "unverified";
    friendly_name?: string;
    created_at: string;
    updated_at: string;
  }>;
}

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const EMPLOYEE_ID = "33333333-3333-4333-8333-333333333333";
const STORAGE_KEY = "sb-127-auth-token";

function fixtureSession(
  aal: "aal1" | "aal2" = "aal1",
  factors: WorkspaceFixtureOptions["mfaFactors"] = [],
) {
  const payload = Buffer.from(JSON.stringify({ sub: USER_ID, role: "authenticated", aal, exp: 4_102_444_800 })).toString("base64url");
  const signature = Buffer.from("fixture-signature").toString("base64url");
  return {
    access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.${signature}`,
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
      factors,
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

export async function prepareAuthenticatedWorkspace(page: Page, options: WorkspaceFixtureOptions = {}) {
  const accessibleAreas: Record<WorkspaceArea, boolean> = {
    central: true,
    industrial: true,
    residencial: true,
    ...options.accessibleAreas,
  };
  const isAdmin = options.isAdmin ?? true;
  const platformAdmin = options.platformAdmin ?? false;
  const modulePermissions = options.modulePermissions ?? {};
  const aal = options.aal ?? "aal1";
  const mfaRequired = options.mfaRequired ?? false;
  const mfaFactors = options.mfaFactors ?? [];
  const operations = options.operations ?? [
    ...(accessibleAreas.industrial ? ["industrial" as const] : []),
    ...(accessibleAreas.residencial ? ["domestico" as const] : []),
  ];
  const units = options.units ?? [{
    id: "44444444-4444-4444-8444-444444444444",
    code: "E2E",
    name: "Unidade E2E",
  }];
  const accessMode = options.accessMode ?? (isAdmin ? "admin" : "pdv");
  const employeeName = options.employeeName ?? "Operador E2E";
  const session = fixtureSession(aal, mfaFactors);

  await page.addInitScript(({ storageKey, session }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(session));
  }, { storageKey: STORAGE_KEY, session });

  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/rest/v1/rpc/get_my_tenant_context")) {
      return fulfillJson(route, {
        activeTenantId: TENANT_ID,
        platformAdmin,
        tenants: [{ id: TENANT_ID, name: "Empresa E2E", slug: "empresa-e2e", role: "admin", active: true }],
      });
    }
    if (pathname.endsWith("/rest/v1/rpc/get_my_security_context")) {
      return fulfillJson(route, {
        tenantId: TENANT_ID,
        isAdmin,
        requireMfaForAdmins: mfaRequired,
        currentAal: aal,
        mfaSatisfied: !isAdmin || !mfaRequired || aal === "aal2",
        policyUpdatedAt: mfaRequired ? "2026-10-27T12:00:00.000Z" : null,
      });
    }
    if (pathname.endsWith("/rest/v1/rpc/get_my_access_context")) {
      return fulfillJson(route, {
        tenantId: TENANT_ID,
        isAdmin,
        operations,
        units,
        unitScope: isAdmin ? "all" : "assigned",
        accessMode,
        defaultRoute: isAdmin
          ? "/admin/visao-geral"
          : operations.includes("industrial")
            ? "/pdv/industrial"
            : operations.includes("domestico")
              ? "/pdv/domestico"
              : null,
      });
    }
    if (pathname.endsWith("/auth/v1/user")) {
      return fulfillJson(route, session.user);
    }
    if (pathname.endsWith("/rest/v1/funcionarios")) {
      return fulfillJson(route, {
        id: EMPLOYEE_ID,
        nome: employeeName,
        cargo: "Administrador",
        email: "e2e@example.invalid",
        avatar_url: null,
        departamento: null,
      });
    }
    if (pathname.endsWith("/rest/v1/rpc/has_area_access")) {
      const body = route.request().postDataJSON() as { _area?: WorkspaceArea } | null;
      return fulfillJson(route, body?._area ? accessibleAreas[body._area] : false);
    }
    if (pathname.endsWith("/rest/v1/rpc/has_role")) {
      return fulfillJson(route, isAdmin);
    }
    if (pathname.endsWith("/rest/v1/rpc/consultar_dashboard_financeiro")) {
      return fulfillJson(route, { message: "Falha simulada para teste visual" }, 500);
    }
    if (pathname.endsWith("/rest/v1/modulo_permissoes")) {
      return fulfillJson(route, Object.entries(modulePermissions).map(([modulo_key, tem_acesso]) => ({ modulo_key, tem_acesso })));
    }
    if (pathname.endsWith("/rest/v1/configuracoes_gerais")) {
      return fulfillJson(route, []);
    }
    return fulfillJson(route, []);
  });
}
