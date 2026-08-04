import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaAccess } from "@/hooks/useAreaAccess";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredArea?: "central" | "industrial" | "residencial";
}

export function ProtectedRoute({ children, requiredArea }: ProtectedRouteProps) {
  const { session, loading } = useAuth();
  const location = useLocation();
  const { data: hasAccess, isLoading: checkingAccess } = useAreaAccess(requiredArea);

  if (loading || checkingAccess) {
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

  if (requiredArea && !hasAccess) {
    // If user doesn't have access to this area, redirect to the first available area or login
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
