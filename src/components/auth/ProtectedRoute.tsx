import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredArea?: "central" | "industrial" | "residencial";
}

export function ProtectedRoute({ children, requiredArea }: ProtectedRouteProps) {
  const { session, loading, funcionario } = useAuth();
  const location = useLocation();

  if (loading) {
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

  // Area-based authorization (Simplified for Phase 1 - base on employee role/unit)
  if (requiredArea && funcionario) {
    const isCentral = funcionario.cargo === "ADMINISTRADOR";
    
    if (requiredArea === "central" && !isCentral) {
      return <Navigate to="/" replace />;
    }
    
    // In Phase 3 we will implement granular unit access check
  }

  return <>{children}</>;
}
