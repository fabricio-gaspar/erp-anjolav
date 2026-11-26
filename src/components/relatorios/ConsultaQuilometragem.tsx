import { lazy, Suspense } from "react";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";

const RelatorioKilometragem = lazy(() => import("@/pages/RelatorioKilometragem"));

export function ConsultaQuilometragem() {
  const permission = usePermissaoModulo("relatorios");
  if (permission.isLoading || !permission.allowed) return null;
  return <details open className="rounded-lg border bg-card text-card-foreground">
    <summary className="cursor-pointer px-5 py-4 font-semibold">Quilometragem percorrida</summary>
    <Suspense fallback={<p className="p-5 text-sm">Carregando relatório…</p>}><RelatorioKilometragem embedded /></Suspense>
  </details>;
}
