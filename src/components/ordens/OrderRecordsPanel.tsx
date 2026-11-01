import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  FileImage,
  FileText,
  Loader2,
  MessageSquareWarning,
  Paperclip,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOrderRecords, type OrderAttachment } from "@/hooks/useOrderRecords";
import { createIdempotencyKey } from "@/lib/idempotency";
import {
  createOrderAttachmentSignedUrl,
  ORDER_ATTACHMENT_CATEGORIES,
  validateOrderAttachmentFile,
  type OrderAttachmentCategory,
} from "@/lib/orderAttachments";

interface OrderRecordsPanelProps {
  orderId: string;
  orderStatus: string;
}

const categoryLabels: Record<OrderAttachmentCategory, string> = {
  recebimento: "Recebimento",
  avaria: "Avaria",
  qualidade: "Qualidade",
  documento: "Documento",
  outro: "Outro",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function OrderRecordsPanel({ orderId, orderStatus }: OrderRecordsPanelProps) {
  const { attachments, uploadAttachment, registerOccurrence, prepareAttachmentPath } = useOrderRecords(orderId);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [category, setCategory] = useState<OrderAttachmentCategory>("recebimento");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingObjectPath, setPendingObjectPath] = useState<string | null>(null);
  const [occurrenceOpen, setOccurrenceOpen] = useState(false);
  const [occurrence, setOccurrence] = useState("");
  const [newForecast, setNewForecast] = useState("");
  const [occurrenceKey, setOccurrenceKey] = useState("");
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ attachment: OrderAttachment; url: string } | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  const openAttachmentForm = () => {
    setCategory("recebimento");
    setDescription("");
    setSelectedFile(null);
    setPendingObjectPath(null);
    setAttachmentOpen(true);
  };

  const openOccurrenceForm = () => {
    setOccurrence("");
    setNewForecast("");
    setOccurrenceKey(createIdempotencyKey("order-incident"));
    setOccurrenceOpen(true);
  };

  const submitAttachment = async () => {
    if (!selectedFile) {
      toast.error("Selecione uma imagem ou um PDF.");
      return;
    }
    if (description.trim().length > 0 && description.trim().length < 3) {
      toast.error("A descrição deve ter ao menos 3 caracteres.");
      return;
    }
    try {
      validateOrderAttachmentFile(selectedFile);
      const objectPath = pendingObjectPath ?? prepareAttachmentPath({ file: selectedFile, category });
      if (!pendingObjectPath) setPendingObjectPath(objectPath);
      await uploadAttachment.mutateAsync({
        file: selectedFile,
        category,
        description,
        objectPath,
      });
      setAttachmentOpen(false);
      setSelectedFile(null);
      setPendingObjectPath(null);
    } catch {
      // The mutation already reports server and storage errors and the form is
      // deliberately preserved for a safe retry with the same object path.
    }
  };

  const submitOccurrence = async () => {
    if (occurrence.trim().length < 3) {
      toast.error("Descreva a ocorrência em pelo menos 3 caracteres.");
      return;
    }
    if (newForecast && newForecast < today) {
      toast.error("A nova previsão não pode estar no passado.");
      return;
    }
    try {
      await registerOccurrence.mutateAsync({
        expectedStage: orderStatus,
        occurrence,
        newForecast: newForecast || undefined,
        idempotencyKey: occurrenceKey,
      });
      setOccurrenceOpen(false);
    } catch {
      // Keep the text and idempotency key after failure or an unknown result.
    }
  };

  const openAttachment = async (attachment: OrderAttachment) => {
    setOpeningAttachmentId(attachment.id);
    try {
      const url = await createOrderAttachmentSignedUrl(attachment.object_path);
      setPreview({ attachment, url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o anexo.");
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paperclip className="h-4 w-4" />
              Ocorrências e anexos
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Evidências privadas ficam vinculadas ao pedido; ocorrências aparecem no histórico operacional.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-11 justify-start gap-2" onClick={openOccurrenceForm}>
              <MessageSquareWarning className="h-4 w-4" /> Registrar ocorrência
            </Button>
            <Button className="h-11 justify-start gap-2" onClick={openAttachmentForm}>
              <Plus className="h-4 w-4" /> Adicionar anexo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {attachments.isLoading ? (
            <div className="flex min-h-24 items-center justify-center" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando anexos...</span>
            </div>
          ) : attachments.error ? (
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4" role="alert">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-destructive">Não foi possível consultar os anexos</p>
                  <p className="text-xs text-muted-foreground">Nenhum erro foi tratado como lista vazia.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => attachments.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : attachments.data?.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center">
              <FileImage className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Nenhum anexo registrado</p>
              <p className="mt-1 text-xs text-muted-foreground">Adicione somente evidências úteis para o atendimento e a operação.</p>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {attachments.data?.map((attachment) => {
                const AttachmentIcon = attachment.content_type === "application/pdf" ? FileText : FileImage;
                return (
                  <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <AttachmentIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{attachment.nome_arquivo}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryLabels[attachment.categoria]}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatFileSize(attachment.size_bytes)} · {format(new Date(attachment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {attachment.descricao && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{attachment.descricao}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      onClick={() => openAttachment(attachment)}
                      disabled={openingAttachmentId === attachment.id}
                      aria-label={`Abrir anexo ${attachment.nome_arquivo}`}
                    >
                      {openingAttachmentId === attachment.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={attachmentOpen} onOpenChange={setAttachmentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar anexo ao pedido</DialogTitle>
            <DialogDescription>
              JPG, PNG, WebP ou PDF de até 8 MB. O arquivo fica privado e não poderá ser sobrescrito após o vínculo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="order-attachment-category">Categoria</Label>
              <Select
                value={category}
                onValueChange={(value) => {
                  setCategory(value as OrderAttachmentCategory);
                  setPendingObjectPath(null);
                }}
              >
                <SelectTrigger id="order-attachment-category" className="h-11 text-base sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_ATTACHMENT_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>{categoryLabels[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-attachment-file">Arquivo</Label>
              <Input
                id="order-attachment-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="h-11 cursor-pointer text-base file:mr-3 file:text-sm sm:text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file) {
                    try {
                      validateOrderAttachmentFile(file);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Arquivo inválido.");
                      event.currentTarget.value = "";
                      setSelectedFile(null);
                      setPendingObjectPath(null);
                      return;
                    }
                  }
                  setSelectedFile(file);
                  setPendingObjectPath(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-attachment-description">Descrição opcional</Label>
              <Textarea
                id="order-attachment-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                placeholder="Explique o que este anexo comprova"
                className="min-h-24 text-base sm:text-sm"
              />
              <p className="text-right text-xs text-muted-foreground">{description.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachmentOpen(false)} disabled={uploadAttachment.isPending}>
              Cancelar
            </Button>
            <Button onClick={submitAttachment} disabled={uploadAttachment.isPending}>
              {uploadAttachment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar anexo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={occurrenceOpen} onOpenChange={setOccurrenceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar ocorrência</DialogTitle>
            <DialogDescription>
              A ocorrência preserva a etapa atual, identifica o operador e entra no histórico imutável do pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="order-occurrence">Descrição da ocorrência</Label>
              <Textarea
                id="order-occurrence"
                value={occurrence}
                onChange={(event) => setOccurrence(event.target.value)}
                maxLength={1000}
                placeholder="Ex.: peça aguardando revisão de acabamento"
                className="min-h-28 text-base sm:text-sm"
              />
              <p className="text-right text-xs text-muted-foreground">{occurrence.length}/1000</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-new-forecast" className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" /> Nova previsão opcional
              </Label>
              <Input
                id="order-new-forecast"
                type="date"
                min={today}
                value={newForecast}
                onChange={(event) => setNewForecast(event.target.value)}
                className="h-11 text-base sm:text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOccurrenceOpen(false)} disabled={registerOccurrence.isPending}>
              Cancelar
            </Button>
            <Button onClick={submitOccurrence} disabled={registerOccurrence.isPending}>
              {registerOccurrence.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar ocorrência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.attachment.nome_arquivo}</DialogTitle>
            <DialogDescription>
              Link privado temporário, válido por cinco minutos. Não compartilhe fora da operação autorizada.
            </DialogDescription>
          </DialogHeader>
          {preview?.attachment.content_type === "application/pdf" ? (
            <iframe
              src={preview.url}
              title={`Pré-visualização de ${preview.attachment.nome_arquivo}`}
              className="h-[65vh] w-full rounded-lg border bg-background"
            />
          ) : preview ? (
            <div className="flex max-h-[65vh] justify-center overflow-auto rounded-lg border bg-muted/20 p-2">
              <img src={preview.url} alt={preview.attachment.descricao || preview.attachment.nome_arquivo} className="max-h-[62vh] max-w-full object-contain" />
            </div>
          ) : null}
          {preview && (
            <DialogFooter>
              <Button asChild variant="outline">
                <a href={preview.url} target="_blank" rel="noreferrer">Abrir em nova aba</a>
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
