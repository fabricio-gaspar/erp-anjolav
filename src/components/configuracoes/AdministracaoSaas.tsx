import { useMemo, useState } from "react";
import { Building2, CheckCircle2, CirclePause, Loader2, Plus, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import {
  type SaasPlan,
  type SaasTenant,
  type SetSubscriptionStatusInput,
  type UpsertSaasPlanInput,
  useAdministracaoSaas,
} from "@/hooks/useAdministracaoSaas";
import type { SubscriptionStatus } from "@/lib/saasPlatform";
import { SAAS_TENANT_PAGE_SIZE } from "@/lib/saasPlatform";

const EMPTY_SELECTION = "__none__";
const EMPTY_TENANT_ROWS: SaasTenant[] = [];
const EMPTY_PLAN_ROWS: SaasPlan[] = [];

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Avaliação",
  active: "Ativa",
  suspended: "Suspensa",
  cancelled: "Cancelada",
};

interface PlanFormState {
  id: string | null;
  code: string;
  name: string;
  description: string;
  maxUsers: string;
  maxOrdersPerMonth: string;
  active: boolean;
}

interface TenantDraft {
  planId: string;
  status: SubscriptionStatus;
}

interface PendingSubscriptionChange {
  tenant: SaasTenant;
  draft: TenantDraft;
}

const EMPTY_PLAN_FORM: PlanFormState = {
  id: null,
  code: "",
  name: "",
  description: "",
  maxUsers: "",
  maxOrdersPerMonth: "",
  active: true,
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não informado" : dateFormatter.format(date);
}

function statusVariant(status: SubscriptionStatus | SaasTenant["status"]): "success" | "warning" | "danger" | "default" {
  if (status === "active") return "success";
  if (status === "trial") return "warning";
  if (status === "suspended") return "danger";
  return "default";
}

function tenantDraft(tenant: SaasTenant, drafts: Record<string, TenantDraft>): TenantDraft {
  return drafts[tenant.id] ?? {
    planId: tenant.subscription?.planId ?? "",
    status: tenant.subscription?.status ?? "trial",
  };
}

function planToForm(plan: SaasPlan): PlanFormState {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description ?? "",
    maxUsers: plan.maxUsers?.toString() ?? "",
    maxOrdersPerMonth: plan.maxOrdersPerMonth?.toString() ?? "",
    active: plan.active,
  };
}

function parseLimit(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

function asPlanInput(form: PlanFormState): UpsertSaasPlanInput | null {
  const maxUsers = parseLimit(form.maxUsers);
  const maxOrdersPerMonth = parseLimit(form.maxOrdersPerMonth);
  const code = form.code.trim().toLowerCase();
  const name = form.name.trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(code) || name.length < 2 || maxUsers === undefined || maxOrdersPerMonth === undefined) {
    return null;
  }

  return {
    ...(form.id ? { id: form.id } : {}),
    code,
    name,
    description: form.description.trim() || null,
    maxUsers,
    maxOrdersPerMonth,
    active: form.active,
  };
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Building2 }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus | SaasTenant["status"] }) {
  const label = status === "active" || status === "suspended" || status === "cancelled"
    ? STATUS_LABELS[status]
    : status === "trial"
      ? STATUS_LABELS.trial
      : "Indefinido";
  return <StatusBadge variant={statusVariant(status)}>{label}</StatusBadge>;
}

export function AdministracaoSaas() {
  const [tenantPage, setTenantPage] = useState(0);
  const { plans, tenants, upsertPlan, setSubscriptionStatus } = useAdministracaoSaas({ tenantPage });
  const [planForm, setPlanForm] = useState<PlanFormState>(EMPTY_PLAN_FORM);
  const [drafts, setDrafts] = useState<Record<string, TenantDraft>>({});
  const [pendingChange, setPendingChange] = useState<PendingSubscriptionChange | null>(null);

  const tenantRows = tenants.data?.tenants ?? EMPTY_TENANT_ROWS;
  const planRows = plans.data ?? EMPTY_PLAN_ROWS;
  const loading = plans.isLoading || tenants.isLoading;
  const failed = plans.isError || tenants.isError;
  const requestError = plans.error ?? tenants.error;
  const errorMessage = requestError instanceof Error
    ? requestError.message
    : "Verifique a autorização da conta e tente novamente.";
  const stats = useMemo(() => ({
    total: tenants.data?.total ?? tenantRows.length,
    active: tenantRows.filter((tenant) => tenant.status === "active").length,
    suspended: tenantRows.filter((tenant) => tenant.status === "suspended").length,
    withoutPlan: tenantRows.filter((tenant) => !tenant.subscription?.planId).length,
  }), [tenantRows, tenants.data?.total]);
  const tenantLimit = tenants.data?.limit ?? SAAS_TENANT_PAGE_SIZE;
  const tenantOffset = tenants.data?.offset ?? tenantPage * SAAS_TENANT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(stats.total / tenantLimit));

  const refresh = async () => {
    await Promise.all([plans.refetch(), tenants.refetch()]);
  };

  const updatePlanForm = (field: keyof PlanFormState, value: string | boolean) => {
    setPlanForm((current) => ({ ...current, [field]: value }));
  };

  const savePlan = async () => {
    const input = asPlanInput(planForm);
    if (!input) {
      toast.error("Informe um código válido, nome e limites inteiros positivos ou deixe os limites em branco.");
      return;
    }

    try {
      await upsertPlan.mutateAsync(input);
      setPlanForm(EMPTY_PLAN_FORM);
      toast.success(input.id ? "Plano atualizado" : "Plano criado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o plano");
    }
  };

  const updateDraft = (tenantId: string, update: Partial<TenantDraft>) => {
    const tenant = tenantRows.find((candidate) => candidate.id === tenantId);
    if (!tenant) return;
    setDrafts((current) => ({
      ...current,
      [tenantId]: { ...tenantDraft(tenant, current), ...update },
    }));
  };

  const requestSubscriptionChange = (tenant: SaasTenant) => {
    const draft = tenantDraft(tenant, drafts);
    if (draft.status !== "cancelled" && !draft.planId) {
      toast.error("Selecione um plano antes de ativar, colocar em avaliação ou suspender uma empresa.");
      return;
    }
    setPendingChange({ tenant, draft });
  };

  const confirmSubscriptionChange = async () => {
    if (!pendingChange) return;
    const payload: SetSubscriptionStatusInput = {
      tenantId: pendingChange.tenant.id,
      planId: pendingChange.draft.planId || null,
      status: pendingChange.draft.status,
      confirmed: true,
    };

    try {
      await setSubscriptionStatus.mutateAsync(payload);
      setDrafts((current) => {
        const next = { ...current };
        delete next[pendingChange.tenant.id];
        return next;
      });
      toast.success("Situação da empresa atualizada");
      setPendingChange(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a empresa");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Carregando administração SaaS…</span>
      </div>
    );
  }

  if (failed) {
    return (
      <Card>
        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
          <XCircle className="h-7 w-7 text-destructive" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Não foi possível carregar a administração SaaS</h2>
            <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo da plataforma">
        <StatCard label="Empresas cadastradas" value={stats.total} icon={Building2} />
        <StatCard label="Ativas nesta página" value={stats.active} icon={CheckCircle2} />
        <StatCard label="Suspensas nesta página" value={stats.suspended} icon={CirclePause} />
        <StatCard label="Sem plano nesta página" value={stats.withoutPlan} icon={ShieldCheck} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> Catálogo de planos</CardTitle>
          <CardDescription>Limites de capacidade internos. Esta tela não cria cobranças nem configura provedores.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="saas-plan-code">Código</Label>
              <Input id="saas-plan-code" value={planForm.code} onChange={(event) => updatePlanForm("code", event.target.value)} placeholder="profissional" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saas-plan-name">Nome</Label>
              <Input id="saas-plan-name" value={planForm.name} onChange={(event) => updatePlanForm("name", event.target.value)} placeholder="Profissional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saas-plan-users">Máximo de usuários</Label>
              <Input id="saas-plan-users" inputMode="numeric" type="number" min="1" value={planForm.maxUsers} onChange={(event) => updatePlanForm("maxUsers", event.target.value)} placeholder="Sem limite" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saas-plan-orders">Máximo de OS/mês</Label>
              <Input id="saas-plan-orders" inputMode="numeric" type="number" min="1" value={planForm.maxOrdersPerMonth} onChange={(event) => updatePlanForm("maxOrdersPerMonth", event.target.value)} placeholder="Sem limite" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="saas-plan-description">Descrição</Label>
              <Input id="saas-plan-description" value={planForm.description} onChange={(event) => updatePlanForm("description", event.target.value)} placeholder="Opcional: finalidade e limites comerciais" />
            </div>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label htmlFor="saas-plan-active">Disponível</Label>
                  <p className="text-xs text-muted-foreground">Permite novas ativações.</p>
                </div>
                <Switch id="saas-plan-active" checked={planForm.active} onCheckedChange={(value) => updatePlanForm("active", value)} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {planForm.id && <Button type="button" variant="outline" onClick={() => setPlanForm(EMPTY_PLAN_FORM)}>Cancelar edição</Button>}
            <Button type="button" onClick={() => void savePlan()} disabled={upsertPlan.isPending}>
              {upsertPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              {planForm.id ? "Salvar plano" : "Criar plano"}
            </Button>
          </div>
          {planRows.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-2" aria-label="Planos cadastrados">
              {planRows.map((plan) => (
                <div key={plan.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{plan.name}</p><StatusBadge variant={plan.active ? "success" : "default"}>{plan.active ? "Disponível" : "Arquivado"}</StatusBadge></div>
                    <p className="text-sm text-muted-foreground">{plan.code} · {plan.maxUsers ?? "Sem"} usuários · {plan.maxOrdersPerMonth ?? "Sem"} OS/mês</p>
                    {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPlanForm(planToForm(plan))}>Editar</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" aria-hidden="true" /> Empresas e assinaturas</CardTitle>
          <CardDescription>Alterações de situação são registradas na auditoria da empresa. Suspender ou cancelar bloqueia o respectivo acesso operacional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tenantRows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma empresa foi encontrada.</div>
          ) : tenantRows.map((tenant) => {
            const draft = tenantDraft(tenant, drafts);
            const availablePlans = planRows.filter((plan) => plan.active || plan.id === draft.planId);
            return (
              <article key={tenant.id} className="space-y-4 rounded-lg border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{tenant.name}</h3><SubscriptionStatusBadge status={tenant.status} /></div>
                    <p className="mt-1 text-sm text-muted-foreground">{tenant.slug} · Última atualização: {formatDate(tenant.subscription?.updatedAt ?? tenant.updatedAt)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{tenant.subscription?.plan?.name ?? "Sem plano"}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`saas-plan-${tenant.id}`}>Plano</Label>
                    <Select value={draft.planId || EMPTY_SELECTION} onValueChange={(value) => updateDraft(tenant.id, { planId: value === EMPTY_SELECTION ? "" : value })}>
                      <SelectTrigger id={`saas-plan-${tenant.id}`}><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_SELECTION}>Sem plano</SelectItem>
                        {availablePlans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`saas-status-${tenant.id}`}>Situação da assinatura</Label>
                    <Select value={draft.status} onValueChange={(value) => updateDraft(tenant.id, { status: value as SubscriptionStatus })}>
                      <SelectTrigger id={`saas-status-${tenant.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as SubscriptionStatus[]).map((status) => <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={() => requestSubscriptionChange(tenant)} disabled={setSubscriptionStatus.isPending}>Revisar alteração</Button>
                </div>
              </article>
            );
          })}
          {stats.total > tenantLimit && (
            <nav className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de empresas">
              <p className="text-sm text-muted-foreground">
                Mostrando {tenantOffset + 1}–{tenantOffset + tenantRows.length} de {stats.total} empresas
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setTenantPage((page) => Math.max(0, page - 1))} disabled={tenantPage === 0 || setSubscriptionStatus.isPending}>
                  Página anterior
                </Button>
                <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">Página {tenantPage + 1} de {totalPages}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setTenantPage((page) => Math.min(totalPages - 1, page + 1))} disabled={tenantPage >= totalPages - 1 || setSubscriptionStatus.isPending}>
                  Próxima página
                </Button>
              </div>
            </nav>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingChange !== null} onOpenChange={(open) => { if (!open && !setSubscriptionStatus.isPending) setPendingChange(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de empresa</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange
                ? `A empresa ${pendingChange.tenant.name} ficará com o status ${STATUS_LABELS[pendingChange.draft.status].toLowerCase()}. Esta alteração atualiza o acesso operacional e será registrada na auditoria.`
                : "Revise a alteração antes de confirmar."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setSubscriptionStatus.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmSubscriptionChange()} disabled={setSubscriptionStatus.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {setSubscriptionStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Confirmar alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
