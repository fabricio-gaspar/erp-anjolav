import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getSaasTenantPageOffset,
  isSubscriptionStatus,
  SAAS_TENANT_PAGE_SIZE,
  type SubscriptionStatus,
  type TenantLifecycleStatus,
} from "@/lib/saasPlatform";

export interface SaasPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  maxUsers: number | null;
  maxOrdersPerMonth: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaasSubscription {
  planId: string | null;
  plan: Pick<SaasPlan, "id" | "code" | "name" | "maxUsers" | "maxOrdersPerMonth" | "active"> | null;
  status: SubscriptionStatus;
  statusChangedAt: string;
  updatedAt: string;
}

export interface SaasTenant {
  id: string;
  name: string;
  slug: string;
  status: TenantLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  subscription: SaasSubscription | null;
}

export interface UpsertSaasPlanInput {
  id?: string;
  code: string;
  name: string;
  description: string | null;
  maxUsers: number | null;
  maxOrdersPerMonth: number | null;
  active: boolean;
}

export interface SetSubscriptionStatusInput {
  tenantId: string;
  planId: string | null;
  status: SubscriptionStatus;
  confirmed: boolean;
}

interface PlatformEnvelope<T> {
  data?: T;
  error?: string;
}

interface RawPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  max_users: number | null;
  max_orders_per_month: number | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface RawSubscription {
  planId: string | null;
  plan: RawPlan | null;
  status: string;
  statusChangedAt: string;
  updatedAt: string;
}

interface RawTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  subscription: RawSubscription | null;
}

interface SaasTenantPage {
  total: number;
  offset: number;
  limit: number;
  tenants: SaasTenant[];
}

interface RawTenantPage {
  total: number;
  offset: number;
  limit: number;
  tenants: RawTenant[];
}

interface UseAdministracaoSaasOptions {
  tenantPage?: number;
}

function isMissingPlatformFunction(error: unknown): boolean {
  const candidate = error as { context?: { status?: unknown }; message?: unknown } | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  return candidate?.context?.status === 404 || /\b404\b|not found|does not exist/i.test(message);
}

function toPlan(plan: RawPlan): SaasPlan {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description ?? null,
    maxUsers: plan.max_users,
    maxOrdersPerMonth: plan.max_orders_per_month,
    active: plan.active,
    createdAt: plan.created_at ?? "",
    updatedAt: plan.updated_at ?? "",
  };
}

function toTenantStatus(value: string): TenantLifecycleStatus {
  return value === "suspended" || value === "cancelled" ? value : "active";
}

function toSubscription(raw: RawSubscription | null): SaasSubscription | null {
  if (!raw || !isSubscriptionStatus(raw.status)) return null;
  return {
    planId: raw.planId,
    plan: raw.plan
      ? {
        id: raw.plan.id,
        code: raw.plan.code,
        name: raw.plan.name,
        maxUsers: raw.plan.max_users,
        maxOrdersPerMonth: raw.plan.max_orders_per_month,
        active: raw.plan.active,
      }
      : null,
    status: raw.status,
    statusChangedAt: raw.statusChangedAt,
    updatedAt: raw.updatedAt,
  };
}

function toTenant(tenant: RawTenant): SaasTenant {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: toTenantStatus(tenant.status),
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    subscription: toSubscription(tenant.subscription),
  };
}

async function platformRequest<T>(body: Record<string, unknown>): Promise<T> {
  // A autorização continua no servidor; a interface apenas encaminha a sessão atual.
  const { data, error } = await supabase.functions.invoke<PlatformEnvelope<T>>(
    "platform-administration",
    { body },
  );
  if (error || data?.data === undefined) {
    if (isMissingPlatformFunction(error) || /\b404\b|not found|does not exist/i.test(data?.error ?? "")) {
      throw new Error("A administração SaaS não está publicada neste ambiente.");
    }
    throw new Error(data?.error || "Não foi possível concluir a administração SaaS");
  }
  return data.data;
}

export function useAdministracaoSaas({ tenantPage = 0 }: UseAdministracaoSaasOptions = {}) {
  const queryClient = useQueryClient();
  const { isPlatformAdmin, session } = useAuth();
  const userId = session?.user.id ?? null;
  const tenantOffset = getSaasTenantPageOffset(tenantPage);
  const enabled = Boolean(userId && isPlatformAdmin);
  const queryScope = ["saas-platform", userId ?? "anonymous"] as const;

  const plans = useQuery({
    queryKey: [...queryScope, "plans"],
    enabled,
    queryFn: async (): Promise<SaasPlan[]> => {
      const result = await platformRequest<{ plans: RawPlan[] }>({ action: "list_plans" });
      return result.plans.map(toPlan);
    },
  });

  const tenants = useQuery({
    queryKey: [...queryScope, "tenants", tenantOffset, SAAS_TENANT_PAGE_SIZE],
    enabled,
    queryFn: async (): Promise<SaasTenantPage> => {
      const result = await platformRequest<RawTenantPage>({
        action: "list_tenants",
        limit: SAAS_TENANT_PAGE_SIZE,
        offset: tenantOffset,
      });
      return {
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        tenants: result.tenants.map(toTenant),
      };
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryScope });

  const upsertPlan = useMutation({
    mutationFn: (plan: UpsertSaasPlanInput) => platformRequest<{ plan: RawPlan }>({
      action: "upsert_plan",
      plan,
    }),
    onSuccess: invalidate,
  });

  const setSubscriptionStatus = useMutation({
    mutationFn: (subscription: SetSubscriptionStatusInput) => platformRequest({
      action: "set_subscription_status",
      subscription,
    }),
    onSuccess: invalidate,
  });

  return {
    plans,
    tenants,
    upsertPlan,
    setSubscriptionStatus,
    enabled,
  };
}
