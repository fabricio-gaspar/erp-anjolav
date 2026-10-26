import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const lifecycleUrl = new URL("../src/lib/saasPlatform.ts", import.meta.url);
const migrationUrl = new URL("../supabase/migrations/20261015119000_platform_administration.sql", import.meta.url);
const edgeFunctionUrl = new URL("../supabase/functions/platform-administration/index.ts", import.meta.url);
const authHelperUrl = new URL("../supabase/functions/_shared/auth.ts", import.meta.url);
const httpHelperUrl = new URL("../supabase/functions/_shared/http.ts", import.meta.url);
const hookUrl = new URL("../src/hooks/useAdministracaoSaas.ts", import.meta.url);
const componentUrl = new URL("../src/components/configuracoes/AdministracaoSaas.tsx", import.meta.url);
const pageUrl = new URL("../src/pages/AdministracaoSaas.tsx", import.meta.url);
const routesUrl = new URL("../src/lib/appRoutes.ts", import.meta.url);
const appUrl = new URL("../src/App.tsx", import.meta.url);
const authContextUrl = new URL("../src/contexts/AuthContext.tsx", import.meta.url);
const configUrl = new URL("../supabase/config.toml", import.meta.url);

function source(url: URL, description: string): string {
  assert.ok(existsSync(url), `${description} deve existir`);
  return readFileSync(url, "utf8").replace(/\r\n/g, "\n");
}

async function loadLifecycle() {
  assert.ok(existsSync(lifecycleUrl), "o contrato de estados SaaS deve existir");
  return import(lifecycleUrl.href);
}

test("aceita somente os estados comerciais previstos e mapeia o ciclo operacional", async () => {
  const {
    getSaasTenantPageOffset,
    isSubscriptionStatus,
    SAAS_TENANT_PAGE_SIZE,
    tenantStatusForSubscription,
  } = await loadLifecycle();

  for (const status of ["trial", "active", "suspended", "cancelled"]) {
    assert.equal(isSubscriptionStatus(status), true, `${status} deve ser aceito`);
  }
  assert.equal(isSubscriptionStatus("overdue"), false);
  assert.equal(isSubscriptionStatus(""), false);
  assert.equal(tenantStatusForSubscription("trial"), "active");
  assert.equal(tenantStatusForSubscription("active"), "active");
  assert.equal(tenantStatusForSubscription("suspended"), "suspended");
  assert.equal(tenantStatusForSubscription("cancelled"), "cancelled");
  assert.equal(SAAS_TENANT_PAGE_SIZE, 50);
  assert.equal(getSaasTenantPageOffset(-1), 0);
  assert.equal(getSaasTenantPageOffset(0), 0);
  assert.equal(getSaasTenantPageOffset(2), 100);
  assert.equal(getSaasTenantPageOffset(Number.POSITIVE_INFINITY), 0);
});

test("a migration mantém a administração de plataforma sem bootstrap automático ou escrita do navegador", () => {
  const migration = source(migrationUrl, "a migration de administração da plataforma");

  for (const table of ["platform_administrators", "saas_plan_catalog", "tenant_service_subscriptions"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /CHECK \(status IN \('trial', 'active', 'suspended', 'cancelled'\)\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.is_platform_admin\(_user_id uuid\)/);
  assert.match(migration, /SECURITY DEFINER\s*\nSET search_path = ''/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.saas_plan_catalog, public\.tenant_service_subscriptions\s*\nFROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT ALL ON TABLE public\.saas_plan_catalog, public\.tenant_service_subscriptions TO service_role/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.platform_set_tenant_service_subscription\(/);
  assert.match(migration, /IF _tenant_id = _actor_tenant_id AND _status IN \('suspended', 'cancelled'\)/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.platform_set_tenant_service_subscription[\s\S]*TO service_role/);
  assert.doesNotMatch(migration, /^\s*INSERT INTO public\.platform_administrators\b/m);
});

test("a Edge Function exige administrador de plataforma e não contém integração de cobrança", () => {
  const edgeFunction = source(edgeFunctionUrl, "a Edge Function de administração da plataforma");
  const authHelper = source(authHelperUrl, "o helper de autorização da plataforma");
  const httpHelper = source(httpHelperUrl, "o helper HTTP da plataforma");
  const config = source(configUrl, "a configuração de Edge Functions");

  assert.match(edgeFunction, /requirePlatformAdmin/);
  assert.match(authHelper, /export async function requirePlatformAdmin/);
  assert.match(authHelper, /await requireUser\(req, supabase\)/);
  assert.match(authHelper, /\.from\("platform_administrators"\)/);
  assert.match(authHelper, /\.eq\("active", true\)/);
  for (const action of ["list_tenants", "list_plans", "upsert_plan", "set_subscription_status"]) {
    assert.match(edgeFunction, new RegExp(`action === "${action}"`));
  }
  assert.match(edgeFunction, /platform_set_tenant_service_subscription/);
  assert.match(edgeFunction, /_actor_tenant_id: authorization\.tenantId/);
  assert.doesNotMatch(edgeFunction, /asaas|create-asaas-charge|\bpix\b|\bboleto\b/i);
  assert.match(config, /\[functions\.platform-administration\][\s\S]*verify_jwt = false/);
  assert.match(edgeFunction, /requirePlatformAdmin/);
  assert.match(httpHelper, /https:\/\/anjolav-erp\.fabriciogasparr\.chatgpt\.site/);
});

test("a rota é escondida para contas comuns e a interface confirma alterações de status", () => {
  const hook = source(hookUrl, "o hook de administração SaaS");
  const component = source(componentUrl, "o componente de administração SaaS");
  const page = source(pageUrl, "a página de administração SaaS");
  const routes = source(routesUrl, "o catálogo de rotas");
  const app = source(appUrl, "o roteador da aplicação");
  const authContext = source(authContextUrl, "o contexto autenticado");

  assert.match(hook, /platform-administration/);
  assert.match(hook, /action: "set_subscription_status"/);
  assert.match(hook, /session\?\.user\.id/);
  assert.match(component, /tenantPage/);
  assert.match(component, /Próxima página/);
  assert.match(component, /AlertDialog/);
  assert.match(component, /setSubscriptionStatus/);
  assert.match(page, /Administração SaaS/);
  assert.match(routes, /path: "\/central\/administracao-saas"/);
  assert.match(routes, /platformAdminOnly: true/);
  assert.match(app, /"\/central\/administracao-saas": AdministracaoSaas/);
  assert.match(app, /platformAdminOnly=/);
  assert.match(authContext, /isPlatformAdmin/);
});
