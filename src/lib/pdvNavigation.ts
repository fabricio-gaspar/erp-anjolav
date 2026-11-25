import { getPdvFrontPath, type PdvArea } from "@/lib/authorization";

interface PdvReturnNavigation {
  to: string;
  label: string;
}

function isPdvWorkbenchPath(value: string, area: PdvArea): boolean {
  const areaSegment = area === "industrial" ? "industrial" : "domestico";
  const pathname = value.split(/[?#]/, 1)[0];
  return new RegExp(`^/pdv/${areaSegment}/(?:rol|delivery|orcamento)/?$`).test(pathname);
}

/** Retorna ao atendimento que abriu o módulo, ou à Central em acessos diretos. */
export function getPdvReturnNavigation(state: unknown, area: PdvArea): PdvReturnNavigation {
  if (state && typeof state === "object" && "pdvReturnTo" in state) {
    const returnTo = (state as { pdvReturnTo?: unknown }).pdvReturnTo;
    if (typeof returnTo === "string" && isPdvWorkbenchPath(returnTo, area)) {
      return { to: returnTo, label: "Voltar ao Balcão / PDV" };
    }
  }

  return { to: getPdvFrontPath(area), label: "Voltar ao painel principal" };
}
