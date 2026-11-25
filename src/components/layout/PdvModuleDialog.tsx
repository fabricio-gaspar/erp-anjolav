import { createContext, useContext, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PdvArea } from "@/lib/authorization";

const PdvModuleDialogContext = createContext(false);

export function usePdvModuleDialog() {
  return useContext(PdvModuleDialogContext);
}

interface PdvModuleDialogProps {
  title: string;
  operation: PdvArea;
  children: ReactNode;
}

export function PdvModuleDialog({ title, operation, children }: PdvModuleDialogProps) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const close = () => navigate(-1);
  const operationLabel = operation === "industrial" ? "Industrial" : "Doméstico";
  const displayTitle = new URLSearchParams(search).get("view") === "rotas" ? "Delivery" : title;

  return (
    <PdvModuleDialogContext.Provider value>
      <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent className="pdv-app-shell pdv-compact-dialog pdv-module-dialog">
          <DialogHeader className="pdv-module-dialog__header">
            <div className="pdv-module-dialog__title-row">
              <DialogTitle>{displayTitle}</DialogTitle>
              <Badge variant="secondary">{operationLabel}</Badge>
            </div>
            <DialogDescription className="sr-only">
              Módulo do PDV. Feche esta janela para voltar ao atendimento.
            </DialogDescription>
          </DialogHeader>
          <div className="pdv-module-dialog__body pdv-layout-main--workspace">
            {children}
          </div>
          <DialogFooter className="pdv-module-dialog__footer" data-pdv-dialog-footer>
            <Button type="button" variant="outline" onClick={close}>
              <ArrowLeft aria-hidden="true" />Voltar ao atendimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PdvModuleDialogContext.Provider>
  );
}
