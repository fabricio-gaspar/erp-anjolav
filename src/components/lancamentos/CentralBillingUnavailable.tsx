import { Database } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CentralBillingUnavailable({ section }: { section: string }) {
  return (
    <Alert role="status">
      <Database className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Consulta consolidada indisponível</AlertTitle>
      <AlertDescription>
        A tela carregou, mas o Supabase ativo ainda não possui o serviço de leitura de {section} sincronizado.
        Isso não confirma que não existam registros. A lista não será apresentada como vazia até que as funções
        seguras de consulta do módulo sejam instaladas no backend.
      </AlertDescription>
    </Alert>
  );
}
