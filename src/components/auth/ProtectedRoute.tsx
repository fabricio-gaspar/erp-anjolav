import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaAccess } from "@/hooks/useAreaAccess";
import { useIsAdmin, usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import type { ModulePermissionKey, RoutePermissionRequirement } from "@/lib/authorization";
import { AlertTriangle, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredArea?: "central" | "industrial" | "residencial";
  requiredModule?: ModulePermissionKey | RoutePermissionRequirement;
  adminOnly?: boolean;
}

export function ProtectedRoute({
  children,
  requiredArea,
  requiredModule,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { session, funcionario, loading, signOut } = useAuth();
  const location = useLocation();
  const {
    data: hasAreaAccess,
    isLoading: checkingArea,
    isError: areaCheckFailed,
  } = useAreaAccess(requiredArea);
  const modulePermission = usePermissaoModulo(requiredModule);
  const adminPermission = useIsAdmin();

  if (
    loading ||
    checkingArea ||
    modulePermission.isLoading ||
    (adminOnly && adminPermission.isLoading)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    // Redirect to login, preserving the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const accessCheckFailed =
    areaCheckFailed || modulePermission.isError || (adminOnly && adminPermission.isError);
  const accessDenied =
    !funcionario ||
    (requiredArea && hasAreaAccess !== true) ||
    (requiredModule && !modulePermission.allowed) ||
    (adminOnly && adminPermission.data !== true);

  if (accessCheckFailed || accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h1 className="text-xl font-bold">
            {accessCheckFailed ? "Não foi possível validar seu acesso" : "Acesso não autorizado"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {accessCheckFailed
              ? "Tente novamente. Se o problema continuar, contate o administrador."
              : !funcionario
                ? "Sua conta não possui um vínculo ativo com um funcionário."
                : adminOnly
                ? "Esta área é exclusiva para administradores."
                : "Seu usuário não possui permissão para acessar esta área ou módulo."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => window.history.back()}>
              Voltar
            </Button>
            <Button onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
