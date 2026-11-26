import { ListaDoDiaModal } from "@/components/caixa/ListaDoDiaModal";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";

export function ConsultaListaDia() {
  const permission = usePermissaoModulo("agenda");
  if (permission.isLoading || !permission.allowed) return null;
  return <ListaDoDiaModal open onOpenChange={() => undefined} embedded />;
}
