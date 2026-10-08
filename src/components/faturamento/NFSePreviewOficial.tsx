import { useState, type CSSProperties } from "react";
import { Expand, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { openPrintClone } from "@/lib/safePrint";

interface Address {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface NFSeOficialData {
  emitente: {
    razao_social: string | null;
    cnpj: string | null;
    inscricao_municipal: string | null;
    inscricao_estadual: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco: Address | null;
    codigo_servico?: string | null;
    aliquota_iss?: number | null;
  };
  tomador: {
    razao_social: string | null;
    cpf_cnpj: string | null;
    tipo_pessoa?: string | null;
    inscricao_municipal?: string | null;
    inscricao_estadual?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco: Address | null;
  };
  numero_nf?: string;
  serie?: string;
  data_emissao?: string;
  competencia?: string;
  chave_acesso?: string;
  codigo_verificacao?: string;
  numero_dps?: string;
  serie_dps?: string;
  data_hora_dps?: string;
  descricao_servico: string;
  valor_servico: number;
  aliquota_iss: number;
  valor_iss: number;
  natureza_operacao?: string;
  codigo_tributacao_nacional?: string;
  codigo_tributacao_municipal?: string;
  ambiente?: "producao" | "homologacao";
  isPrevia?: boolean;
  regime_tributario?: string | null;
  informacoes_adicionais?: string | null;
}

const sectionStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "14px",
};

const labelStyle: CSSProperties = {
  color: "#475569",
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const valueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: "13px",
  overflowWrap: "anywhere",
};

function formatDocument(value: string | null): string {
  if (!value) return "Não informado";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return value;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatAddress(address: Address | null): string {
  if (!address) return "Não informado";
  const street = [address.logradouro, address.numero].filter(Boolean).join(", ");
  const locality = [address.bairro, address.cidade, address.uf].filter(Boolean).join(" - ");
  const cep = address.cep ? `CEP ${address.cep}` : "";
  return [street, address.complemento, locality, cep].filter(Boolean).join(" · ") || "Não informado";
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "Não informado" : value;
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{display}</span>
    </div>
  );
}

function PreviewDocument({ data }: { data: NFSeOficialData }) {
  const configuredRate = Number.isFinite(data.aliquota_iss) ? data.aliquota_iss : 0;
  const estimatedIss = Number.isFinite(data.valor_iss)
    ? data.valor_iss
    : data.valor_servico * (configuredRate / 100);

  return (
    <article
      id="nfse-preview-oficial"
      style={{
        background: "#fff",
        color: "#0f172a",
        fontFamily: "Arial, Helvetica, sans-serif",
        margin: "0 auto",
        maxWidth: "820px",
        minHeight: "1000px",
        padding: "28px",
        position: "relative",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          color: "rgba(185, 28, 28, 0.09)",
          fontSize: "58px",
          fontWeight: 800,
          left: "50%",
          pointerEvents: "none",
          position: "absolute",
          top: "50%",
          transform: "translate(-50%, -50%) rotate(-28deg)",
          whiteSpace: "nowrap",
        }}
      >
        SEM VALOR FISCAL
      </div>

      <header style={{ borderBottom: "3px solid #b91c1c", paddingBottom: "16px", position: "relative" }}>
        <div style={{ color: "#b91c1c", fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em" }}>
          PRÉVIA DE DADOS — DOCUMENTO NÃO EMITIDO
        </div>
        <h1 style={{ fontSize: "24px", margin: "6px 0" }}>Dados preparados para NFS-e</h1>
        <p style={{ color: "#475569", fontSize: "12px", lineHeight: 1.5, margin: 0 }}>
          Esta visualização serve apenas para conferência. Número, chave de acesso, protocolo, QR Code,
          código de verificação e DANFSE somente existem após autorização do provedor fiscal homologado.
        </p>
      </header>

      <div
        style={{
          background: "#fff7ed",
          border: "1px solid #fdba74",
          borderRadius: "8px",
          color: "#9a3412",
          fontSize: "12px",
          fontWeight: 700,
          margin: "16px 0",
          padding: "10px 12px",
          position: "relative",
        }}
      >
        Ambiente configurado: {data.ambiente === "producao" ? "produção" : "homologação"}. Essa configuração não comprova emissão.
      </div>

      <div style={{ display: "grid", gap: "14px", position: "relative" }}>
        <section style={sectionStyle}>
          <h2 style={{ fontSize: "15px", margin: "0 0 12px" }}>Prestador do serviço</h2>
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <Field label="Razão social" value={data.emitente.razao_social} />
            <Field label="CNPJ" value={formatDocument(data.emitente.cnpj)} />
            <Field label="Inscrição municipal" value={data.emitente.inscricao_municipal} />
            <Field label="Inscrição estadual" value={data.emitente.inscricao_estadual} />
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Endereço" value={formatAddress(data.emitente.endereco)} />
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ fontSize: "15px", margin: "0 0 12px" }}>Tomador do serviço</h2>
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <Field label="Razão social / nome" value={data.tomador.razao_social} />
            <Field label="CPF / CNPJ" value={formatDocument(data.tomador.cpf_cnpj)} />
            <Field label="Inscrição municipal" value={data.tomador.inscricao_municipal} />
            <Field label="Inscrição estadual" value={data.tomador.inscricao_estadual} />
            <Field label="E-mail" value={data.tomador.email} />
            <Field label="Telefone" value={data.tomador.telefone} />
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Endereço" value={formatAddress(data.tomador.endereco)} />
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ fontSize: "15px", margin: "0 0 12px" }}>Serviço e tributação configurada</h2>
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div style={{ gridColumn: "1 / -1", whiteSpace: "pre-wrap" }}>
              <Field label="Descrição" value={data.descricao_servico} />
            </div>
            <Field label="Valor do serviço" value={formatMoney(data.valor_servico)} />
            <Field label="Natureza da operação" value={data.natureza_operacao} />
            <Field label="Código do serviço" value={data.emitente.codigo_servico} />
            <Field label="Código de tributação nacional" value={data.codigo_tributacao_nacional} />
            <Field label="Código de tributação municipal" value={data.codigo_tributacao_municipal} />
            <Field label="Alíquota ISS configurada" value={`${configuredRate.toLocaleString("pt-BR")} %`} />
            <Field label="ISS estimado para conferência" value={formatMoney(estimatedIss)} />
          </div>
          <p style={{ color: "#9a3412", fontSize: "11px", lineHeight: 1.45, margin: "12px 0 0" }}>
            A tributação acima é uma estimativa baseada no cadastro local e deve ser confirmada pelo provedor fiscal e pelo responsável tributário.
          </p>
        </section>

        {data.informacoes_adicionais && (
          <section style={sectionStyle}>
            <Field label="Informações adicionais" value={data.informacoes_adicionais} />
          </section>
        )}
      </div>

      <footer style={{ borderTop: "1px solid #cbd5e1", color: "#64748b", fontSize: "11px", marginTop: "18px", paddingTop: "12px", position: "relative", textAlign: "center" }}>
        Prévia para conferência interna. Não utilizar como nota fiscal, comprovante tributário ou documento de cobrança.
      </footer>
    </article>
  );
}

export function NFSePreviewOficial({
  data,
  onPrint,
}: {
  data: NFSeOficialData;
  onPrint?: () => void;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    const content = document.getElementById("nfse-preview-oficial");
    if (!content) return;
    const printWindow = openPrintClone(
      content,
      "Prévia NFS-e — sem valor fiscal",
      "@page { size: A4; margin: 8mm; } * { box-sizing: border-box; } body { margin: 0; }",
    );
    if (printWindow) setTimeout(() => printWindow.print(), 250);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-end gap-2 print:hidden sm:flex-row">
        <Button variant="outline" size="sm" onClick={() => setIsFullscreen(true)} className="gap-2">
          <Expand className="h-4 w-4" />
          Tela cheia
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Imprimir / salvar PDF
        </Button>
      </div>

      <div className="max-h-[600px] overflow-auto rounded-lg border bg-white">
        <PreviewDocument data={data} />
      </div>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-auto p-0">
          <DialogTitle className="sr-only">Prévia de dados para NFS-e em tela cheia</DialogTitle>
          <div className="p-4">
            <div className="mb-4 flex justify-end print:hidden">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimir / salvar PDF
              </Button>
            </div>
            <PreviewDocument data={data} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
