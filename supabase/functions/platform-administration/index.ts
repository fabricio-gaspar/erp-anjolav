import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requirePlatformAdmin } from "../_shared/auth.ts";
import {
  handlePreflight,
  jsonResponse,
  readJsonBody,
  requireJsonPost,
} from "../_shared/http.ts";

const SUBSCRIPTION_STATUSES = ["trial", "active", "suspended", "cancelled"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLAN_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,62}$/;

type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

interface PlatformRequest {
  action?: unknown;
  limit?: unknown;
  offset?: unknown;
  plan?: unknown;
  subscription?: unknown;
}

interface PlanInput {
  id: string | null;
  code: string;
  name: string;
  description: string | null;
  maxUsers: number | null;
  maxOrdersPerMonth: number | null;
  active: boolean;
}

interface SubscriptionInput {
  tenantId: string;
  planId: string | null;
  status: SubscriptionStatus;
  confirmed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === "string" && (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return text(value, maxLength);
}

function optionalLimit(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1_000_000
    ? value
    : undefined;
}

function boundedInteger(value: unknown, fallback: number, maximum: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? Math.min(value, maximum)
    : fallback;
}

function parsePlan(value: unknown): PlanInput | null {
  if (!isRecord(value)) return null;
  const code = text(value.code, 63)?.toLowerCase();
  const name = text(value.name, 120);
  const description = optionalText(value.description, 1000);
  const maxUsers = optionalLimit(value.maxUsers);
  const maxOrdersPerMonth = optionalLimit(value.maxOrdersPerMonth);
  const id = value.id === undefined || value.id === null || value.id === "" ? null : value.id;

  if (!code || !PLAN_CODE_PATTERN.test(code) || !name || description === undefined || maxUsers === undefined || maxOrdersPerMonth === undefined) {
    return null;
  }
  if (id !== null && !isUuid(id)) return null;
  if (typeof value.active !== "boolean") return null;

  return { id, code, name, description, maxUsers, maxOrdersPerMonth, active: value.active };
}

function parseSubscription(value: unknown): SubscriptionInput | null {
  if (!isRecord(value) || !isUuid(value.tenantId) || !isSubscriptionStatus(value.status)) return null;
  const planId = value.planId === null || value.planId === undefined || value.planId === "" ? null : value.planId;
  if (planId !== null && !isUuid(planId)) return null;
  if (value.status !== "cancelled" && planId === null) return null;
  return {
    tenantId: value.tenantId,
    planId,
    status: value.status,
    confirmed: value.confirmed === true,
  };
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error ? String(error.code) : "unexpected";
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { error: "Serviço temporariamente indisponível" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const authorization = await requirePlatformAdmin(req, supabase);
  if (!authorization.ok) return authorization.response;

  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  if (!isRecord(parsedBody.value)) return jsonResponse(req, { error: "JSON inválido" }, 400);
  const body = parsedBody.value as PlatformRequest;
  const action = body.action;

  try {
    if (action === "list_tenants") {
      const limit = boundedInteger(body.limit, 50, 100);
      const offset = boundedInteger(body.offset, 0, 5_000);
      const plansPromise = supabase
        .from("saas_plan_catalog")
        .select("id, code, name, max_users, max_orders_per_month, active")
        .order("name", { ascending: true });
      const tenantsPromise = supabase
        .from("tenants")
        .select("id, nome, slug, status, created_at, updated_at")
        .order("nome", { ascending: true })
        .range(offset, offset + limit - 1);
      const totalPromise = supabase.from("tenants").select("id", { count: "exact", head: true });
      const [plansResult, tenantsResult, totalResult] = await Promise.all([
        plansPromise,
        tenantsPromise,
        totalPromise,
      ]);
      if (plansResult.error) throw plansResult.error;
      if (tenantsResult.error) throw tenantsResult.error;
      if (totalResult.error) throw totalResult.error;

      const tenants = tenantsResult.data ?? [];
      const tenantIds = tenants.map((tenant) => tenant.id);
      const subscriptionsResult = tenantIds.length > 0
        ? await supabase
          .from("tenant_service_subscriptions")
          .select("tenant_id, plan_id, status, status_changed_at, updated_at, updated_by")
          .in("tenant_id", tenantIds)
        : { data: [], error: null };
      if (subscriptionsResult.error) throw subscriptionsResult.error;

      const planById = new Map((plansResult.data ?? []).map((plan) => [plan.id, plan]));
      const subscriptionByTenantId = new Map(
        (subscriptionsResult.data ?? []).map((subscription) => [subscription.tenant_id, subscription]),
      );

      return jsonResponse(req, {
        data: {
          total: totalResult.count ?? 0,
          offset,
          limit,
          tenants: tenants.map((tenant) => {
            const subscription = subscriptionByTenantId.get(tenant.id) ?? null;
            return {
              id: tenant.id,
              name: tenant.nome,
              slug: tenant.slug,
              status: tenant.status,
              createdAt: tenant.created_at,
              updatedAt: tenant.updated_at,
              subscription: subscription
                ? {
                  planId: subscription.plan_id,
                  plan: subscription.plan_id ? planById.get(subscription.plan_id) ?? null : null,
                  status: subscription.status,
                  statusChangedAt: subscription.status_changed_at,
                  updatedAt: subscription.updated_at,
                }
                : null,
            };
          }),
        },
      });
    }

    if (action === "list_plans") {
      const { data, error } = await supabase
        .from("saas_plan_catalog")
        .select("id, code, name, description, max_users, max_orders_per_month, active, created_at, updated_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return jsonResponse(req, { data: { plans: data ?? [] } });
    }

    if (action === "upsert_plan") {
      const plan = parsePlan(body.plan);
      if (!plan) return jsonResponse(req, { error: "Dados de plano inválidos" }, 400);

      const values = {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        max_users: plan.maxUsers,
        max_orders_per_month: plan.maxOrdersPerMonth,
        active: plan.active,
      };
      const result = plan.id
        ? await supabase
          .from("saas_plan_catalog")
          .update(values)
          .eq("id", plan.id)
          .select("id, code, name, description, max_users, max_orders_per_month, active, created_at, updated_at")
          .maybeSingle()
        : await supabase
          .from("saas_plan_catalog")
          .insert(values)
          .select("id, code, name, description, max_users, max_orders_per_month, active, created_at, updated_at")
          .single();
      if (result.error) throw result.error;
      if (!result.data) return jsonResponse(req, { error: "Plano não encontrado" }, 404);
      return jsonResponse(req, { data: { plan: result.data } });
    }

    if (action === "set_subscription_status") {
      const subscription = parseSubscription(body.subscription);
      if (!subscription) return jsonResponse(req, { error: "Dados de assinatura inválidos" }, 400);
      if (["suspended", "cancelled"].includes(subscription.status) && !subscription.confirmed) {
        return jsonResponse(req, { error: "Confirmação obrigatória para alterar o acesso da empresa" }, 400);
      }

      const { data, error } = await supabase.rpc("platform_set_tenant_service_subscription", {
        _tenant_id: subscription.tenantId,
        _plan_id: subscription.planId,
        _status: subscription.status,
        _actor_id: authorization.user.id,
        _actor_tenant_id: authorization.tenantId,
      });
      if (error) throw error;
      return jsonResponse(req, { data: { subscription: data } });
    }

    return jsonResponse(req, { error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("Falha na administração da plataforma", {
      action: typeof action === "string" ? action : "unknown",
      errorCode: errorCode(error),
      userId: authorization.user.id,
    });
    return jsonResponse(req, { error: "Não foi possível concluir a operação administrativa" }, 500);
  }
});
