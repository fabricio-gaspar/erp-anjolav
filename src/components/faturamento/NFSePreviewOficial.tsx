import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Printer, Download, Expand } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export interface NFSeOficialData {
  // Emitente
  emitente: {
    razao_social: string | null;
    cnpj: string | null;
    inscricao_municipal: string | null;
    inscricao_estadual: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco: {
      logradouro?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cidade?: string | null;
      uf?: string | null;
      cep?: string | null;
    } | null;
    codigo_servico?: string | null;
    aliquota_iss?: number | null;
  };
  // Tomador
  tomador: {
    razao_social: string | null;
    cpf_cnpj: string | null;
    tipo_pessoa?: string | null;
    inscricao_municipal?: string | null;
    inscricao_estadual?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco: {
      logradouro?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cidade?: string | null;
      uf?: string | null;
      cep?: string | null;
    } | null;
  };
  // Dados da NF
  numero_nf?: string;
  serie?: string;
  data_emissao?: string;
  competencia?: string;
  chave_acesso?: string;
  codigo_verificacao?: string;
  numero_dps?: string;
  serie_dps?: string;
  data_hora_dps?: string;
  // Serviço
  descricao_servico: string;
  valor_servico: number;
  aliquota_iss: number;
  valor_iss: number;
  natureza_operacao?: string;
  codigo_tributacao_nacional?: string;
  codigo_tributacao_municipal?: string;
  // Ambiente
  ambiente?: "producao" | "homologacao";
  isPrevia?: boolean;
  // Extras
  regime_tributario?: string | null;
  informacoes_adicionais?: string | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCNPJ = (cnpj: string | null) => {
  if (!cnpj) return "";
  const c = cnpj.replace(/\D/g, "");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return cnpj;
};

const formatCEP = (cep: string | null) => {
  if (!cep) return "";
  const c = cep.replace(/\D/g, "");
  if (c.length === 8) return c.replace(/(\d{5})(\d{3})/, "$1-$2");
  return cep;
};

// =================== STYLES ===================
const BORDER = "1px solid #000";
const HEADER_BG = "#cfcfcf";
const SUBHEADER_BG = "#e8e8e8";

const td = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: BORDER,
  padding: "3px 5px",
  fontSize: "8.5px",
  verticalAlign: "top",
  ...extra,
});

const sectionHeader: React.CSSProperties = {
  border: BORDER,
  background: HEADER_BG,
  textAlign: "center",
  fontWeight: "bold",
  fontSize: "9px",
  padding: "3px",
};

const subHeader = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: BORDER,
  background: SUBHEADER_BG,
  fontSize: "7.5px",
  padding: "2px 5px",
  fontWeight: "normal",
  ...extra,
});

const lbl: React.CSSProperties = {
  fontSize: "6.5px",
  color: "#333",
  display: "block",
  lineHeight: "1.1",
};

const val: React.CSSProperties = {
  fontSize: "9px",
  color: "#000",
  display: "block",
  lineHeight: "1.2",
};

// Field with label on top, value below — used in many cells
function Field({
  label,
  children,
  bold,
}: {
  label: string;
  children?: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <>
      <span style={lbl}>{label}</span>
      <span style={{ ...val, fontWeight: bold ? "bold" : "normal" }}>
        {children ?? "\u00A0"}
      </span>
    </>
  );
}

// =================== BARCODE ===================
// Renderização visual de Code128 (barras pseudo-aleatórias derivadas dos dígitos).
// Não é leitura óptica real, mas reproduz fielmente o visual do modelo.
function Barcode({ value }: { value: string }) {
  const digits = value.replace(/\D/g, "") || "0";
  // Gera larguras de barras a partir dos dígitos
  const bars: { w: number; fill: boolean }[] = [];
  // quiet zone start
  bars.push({ w: 8, fill: false });
  // start guard
  bars.push({ w: 2, fill: true });
  bars.push({ w: 1, fill: false });
  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[i], 10);
    // padrão: 4 elementos por dígito
    const widths = [
      ((d * 7) % 3) + 1,
      ((d * 13) % 3) + 1,
      ((d * 17) % 2) + 1,
      ((d * 23) % 3) + 1,
    ];
    bars.push({ w: widths[0], fill: true });
    bars.push({ w: widths[1], fill: false });
    bars.push({ w: widths[2], fill: true });
    bars.push({ w: widths[3], fill: false });
  }
  // stop guard
  bars.push({ w: 2, fill: true });
  bars.push({ w: 1, fill: false });
  bars.push({ w: 2, fill: true });
  bars.push({ w: 8, fill: false });

  const totalW = bars.reduce((s, b) => s + b.w, 0);
  const height = 38;
  let x = 0;

  return (
    <div style={{ textAlign: "center" }}>
      <svg
        viewBox={`0 0 ${totalW} ${height}`}
        width="320"
        height={height}
        preserveAspectRatio="none"
        style={{ display: "block", margin: "0 auto" }}
      >
        {bars.map((b, i) => {
          const rect = b.fill ? (
            <rect key={i} x={x} y={0} width={b.w} height={height} fill="#000" />
          ) : null;
          x += b.w;
          return rect;
        })}
      </svg>
      <div
        style={{
          fontFamily: "Courier, monospace",
          fontSize: "9px",
          letterSpacing: "2px",
          marginTop: "2px",
          fontWeight: "bold",
        }}
      >
        {digits}
      </div>
    </div>
  );
}

// =================== CONTENT ===================
function NFSeContent({ data }: { data: NFSeOficialData }) {
  const ee = data.emitente.endereco;
  const et = data.tomador.endereco;

  const hoje = new Date();
  const dataEmissao = data.data_emissao || hoje.toLocaleDateString("pt-BR");
  const horaEmissao = hoje.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const codVerif = data.codigo_verificacao || data.chave_acesso?.slice(-9) || "PREVIA000";
  const numero = data.numero_nf || "PRÉVIA";
  const cnpjLimpo = (data.emitente.cnpj || "").replace(/\D/g, "");
  const chave =
    data.chave_acesso ||
    `35506051${cnpjLimpo.padEnd(14, "0")}000000000${(numero || "0").padStart(5, "0")}26041797416559`;
  const numeroDps = data.numero_dps || numero;
  const serieDps = data.serie_dps || "49999";
  const dataHoraDps = data.data_hora_dps || `${dataEmissao} ${horaEmissao}`;
  const cidadePrest = ee?.cidade || "São Roque";
  const ufPrest = ee?.uf || "SP";

  const aliquotaEfetiva =
    data.valor_servico > 0 ? (data.valor_iss / data.valor_servico) * 100 : data.aliquota_iss;

  const valorMun = data.valor_iss * 0.88;
  const valorFed = data.valor_iss * 2.96;
  const valorTotalAprox = valorMun + valorFed;

  const portalUrl = "https://webapp1-saoroque.cidade360.cloud/nfse.portal";
  const qrUrl = `${portalUrl}/verificar/${codVerif}`;
  const codServ = data.emitente.codigo_servico || "14.10";
  const codTribNac = data.codigo_tributacao_nacional || "14.10.01";
  const codTribMun = data.codigo_tributacao_municipal || "1410";

  const isSimples =
    !data.regime_tributario ||
    /simples|mei/i.test(data.regime_tributario);

  const barcodeValue = `${numero || "0"}${codVerif}${cnpjLimpo}`;

  return (
    <div
      id="nfse-preview-oficial"
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "9px",
        color: "#000",
        background: "#fff",
        padding: "8mm",
        maxWidth: "210mm",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Marca d'água */}
      {data.isPrevia && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-45deg)",
            fontSize: "60px",
            color: "rgba(200, 0, 0, 0.10)",
            fontWeight: "bold",
            pointerEvents: "none",
            zIndex: 1,
            whiteSpace: "nowrap",
          }}
        >
          PRÉVIA - SEM VALOR FISCAL
        </div>
      )}

      {/* ===== TÍTULO ===== */}
      <div
        style={{
          textAlign: "center",
          fontWeight: "bold",
          fontSize: "16px",
          padding: "4px 0 8px 0",
          color: "#000",
        }}
      >
        NFS-e&nbsp;&nbsp;Nota Fiscal de Serviço Eletrônica
      </div>

      {/* ===== BLOCO 1: EMITENTE + QR + NÚMERO/SÉRIE ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            {/* Emitente */}
            <td style={td({ width: "55%", padding: "6px 8px" })}>
              <div style={{ fontWeight: "bold", fontSize: "10px", marginBottom: "2px" }}>
                {data.emitente.razao_social}
              </div>
              {ee && (
                <>
                  <div>
                    {ee.logradouro}
                    {ee.numero ? `, ${ee.numero}` : ""}
                    {ee.complemento ? ` - ${ee.complemento}` : ""}
                  </div>
                  <div>
                    CEP: {formatCEP(ee.cep)} - Bairro: {ee.bairro}
                  </div>
                  <div>
                    Município: {ee.cidade} - {ee.uf}
                  </div>
                </>
              )}
              <div>E-mail: {data.emitente.email || "—"}</div>
              <div>Fone: {data.emitente.telefone || "—"}</div>
            </td>

            {/* QR Code */}
            <td style={td({ width: "20%", textAlign: "center", padding: "6px" })}>
              <QRCodeSVG value={qrUrl} size={92} />
            </td>

            {/* Número / Série / Data / Cód.Verif. */}
            <td style={{ width: "25%", padding: 0, border: BORDER, verticalAlign: "top" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td colSpan={2} style={td({ borderTop: "none", borderRight: "none", borderLeft: "none", textAlign: "center", padding: "4px" })}>
                      <span style={lbl}>Número da NFS-e</span>
                      <div style={{ fontSize: "16px", fontWeight: "bold" }}>{numero}</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={td({ borderRight: "none", borderLeft: "none", textAlign: "center", padding: "4px" })}>
                      <span style={lbl}>Série da NFS-e</span>
                      <div style={{ fontSize: "11px", fontWeight: "bold" }}>{data.serie || "NACIONAL"}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style={td({ borderLeft: "none", borderBottom: "none", width: "55%", textAlign: "center", padding: "4px" })}>
                      <span style={lbl}>Data do Serviço</span>
                      <div style={{ fontSize: "10px", fontWeight: "bold" }}>{dataEmissao}</div>
                    </td>
                    <td style={td({ borderRight: "none", borderBottom: "none", textAlign: "center", padding: "4px" })}>
                      <span style={lbl}>Código Verificador</span>
                      <div style={{ fontSize: "10px", fontWeight: "bold" }}>{codVerif}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== BLOCO 2: CNPJ EMITENTE + PREFEITURA ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={td({ width: "18.33%" })}>
              <Field label="CNPJ / CPF">{formatCNPJ(data.emitente.cnpj)}</Field>
            </td>
            <td style={td({ width: "18.33%" })}>
              <Field label="Inscrição Estadual">{data.emitente.inscricao_estadual || "0"}</Field>
            </td>
            <td style={td({ width: "18.34%" })}>
              <Field label="Inscrição Municipal">{data.emitente.inscricao_municipal || "—"}</Field>
            </td>
            <td colSpan={3} style={td({ width: "45%", padding: 0 })}>
              {/* placeholder - preenchido pela faixa prefeitura abaixo */}
              &nbsp;
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== BLOCO 3: PREFEITURA + ATRIBUTOS ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td rowSpan={2} style={td({ width: "40%", padding: "6px" })}>
              <div style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    border: "1px solid #999",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "6px",
                    color: "#666",
                    fontWeight: "bold",
                    textAlign: "center",
                    flexShrink: 0,
                    background: "#fafafa",
                  }}
                >
                  BRASÃO
                </div>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "9px" }}>PREFEITURA DA ESTANCIA</div>
                  <div style={{ fontWeight: "bold", fontSize: "9px" }}>TURISTICA DE SAO ROQUE/SP</div>
                  <div style={{ fontSize: "8px" }}>Divisão de Rendas</div>
                  <div style={{ fontSize: "7.5px" }}>Fone: (11) 4784-8514 - {portalUrl}</div>
                </div>
              </div>
            </td>
            <td style={td({ width: "15%", textAlign: "center" })}>
              <Field label="Dt. de Emissão" />
            </td>
            <td style={td({ width: "15%", textAlign: "center" })}>
              <Field label="Exigibilidade ISS" />
            </td>
            <td style={td({ width: "15%", textAlign: "center" })}>
              <span style={lbl}>Município de</span>
              <span style={lbl}>Prestação Serviço</span>
            </td>
            <td style={td({ width: "15%", textAlign: "center" })}>
              <Field label="Tributado no Município" />
            </td>
          </tr>
          <tr>
            <td style={td({ textAlign: "center", padding: "5px" })}>
              <span style={{ ...val, fontWeight: "bold" }}>{dataEmissao}</span>
            </td>
            <td style={td({ textAlign: "center", padding: "5px" })}>
              <span style={{ ...val, fontWeight: "bold" }}>Exigível</span>
            </td>
            <td style={td({ textAlign: "center", padding: "5px" })}>
              <span style={{ ...val, fontWeight: "bold" }}>{cidadePrest}/{ufPrest}</span>
            </td>
            <td style={td({ textAlign: "center", padding: "5px" })}>
              <span style={{ ...val, fontWeight: "bold" }}>{cidadePrest}/{ufPrest}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== BLOCO 4: CHAVE DE ACESSO + DPS ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={td({ width: "50%", padding: "4px 6px" })}>
              <span style={lbl}>Chave de Acesso da NFS-e</span>
              <div style={{ fontSize: "9px", letterSpacing: "0.5px", fontFamily: "monospace" }}>
                {chave}
              </div>
            </td>
            <td style={td({ width: "12%" })}>
              <Field label="Número DPS">{numeroDps}</Field>
            </td>
            <td style={td({ width: "13%" })}>
              <Field label="Série DPS">{serieDps}</Field>
            </td>
            <td style={td({ width: "25%" })}>
              <Field label="Data e hora de Emissão da DPS">{dataHoraDps}</Field>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== TOMADOR ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td colSpan={6} style={sectionHeader}>TOMADOR DO SERVIÇO</td>
          </tr>
          <tr>
            <td colSpan={4} style={td({ width: "65%" })}>
              <Field label="Nome / Razão Social" bold>
                {data.tomador.razao_social}
              </Field>
            </td>
            <td colSpan={2} style={td({ width: "35%" })}>
              <Field label="CNPJ / CPF" bold>
                {formatCNPJ(data.tomador.cpf_cnpj) || "—"}
              </Field>
            </td>
          </tr>
          <tr>
            <td colSpan={4} style={td()}>
              <Field label="Endereço">
                {et?.logradouro}
                {et?.numero ? `, ${et.numero}` : ""}
                {et?.complemento ? ` - ${et.complemento}` : ""}
              </Field>
            </td>
            <td style={td()}>
              <Field label="Inscrição Municipal">{data.tomador.inscricao_municipal || "—"}</Field>
            </td>
            <td style={td()}>
              <Field label="Inscrição Estadual">{data.tomador.inscricao_estadual || "—"}</Field>
            </td>
          </tr>
          <tr>
            <td style={td({ width: "20%" })}>
              <Field label="Cidade">{et?.cidade || "—"}</Field>
            </td>
            <td style={td({ width: "6%" })}>
              <Field label="UF">{et?.uf || "—"}</Field>
            </td>
            <td style={td({ width: "20%" })}>
              <Field label="Bairro">{et?.bairro || "—"}</Field>
            </td>
            <td style={td({ width: "12%" })}>
              <Field label="CEP">{formatCEP(et?.cep || null) || "—"}</Field>
            </td>
            <td style={td({ width: "27%" })}>
              <Field label="E-mail">{data.tomador.email || "—"}</Field>
            </td>
            <td style={td({ width: "15%" })}>
              <Field label="Fone">{data.tomador.telefone || "—"}</Field>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== INTERMEDIÁRIO ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td colSpan={5} style={sectionHeader}>INTERMEDIÁRIO DO SERVIÇO</td>
          </tr>
          <tr>
            <td style={td({ width: "35%" })}>
              <Field label="Nome / Razão Social">*****</Field>
            </td>
            <td style={td({ width: "20%" })}>
              <Field label="CNPJ / CPF">*****</Field>
            </td>
            <td style={td({ width: "15%" })}>
              <Field label="Inscrição Municipal">*****</Field>
            </td>
            <td style={td({ width: "20%" })}>
              <Field label="E-mail">*****</Field>
            </td>
            <td style={td({ width: "10%" })}>
              <Field label="Fone">*****</Field>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== DESCRIÇÃO DOS SERVIÇOS ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ ...sectionHeader, width: "55%" }}>DESCRIÇÃO DOS SERVIÇOS</td>
            <td style={subHeader({ textAlign: "right", fontWeight: "bold", width: "12%" })}>VALOR TOTAL</td>
            <td style={subHeader({ textAlign: "right", fontWeight: "bold", width: "10%" })}>ALIQ. ISSQN</td>
            <td style={subHeader({ textAlign: "right", fontWeight: "bold", width: "13%" })}>VALOR ISSQN</td>
            <td style={subHeader({ textAlign: "center", fontWeight: "bold", width: "10%" })}>RETIDO</td>
          </tr>
          <tr>
            <td rowSpan={3} style={td({ padding: "8px", height: "240px", verticalAlign: "top" })}>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {data.descricao_servico}.. Alíquota Efetiva: {aliquotaEfetiva.toFixed(10)}%.
              </div>
            </td>
            <td style={td({ textAlign: "right", padding: "5px", fontWeight: "bold" })}>
              {fmt(data.valor_servico)}
            </td>
            <td style={td({ textAlign: "right", padding: "5px" })}>
              {fmt(data.aliquota_iss)}
            </td>
            <td style={td({ textAlign: "right", padding: "5px", fontWeight: "bold" })}>
              {fmt(data.valor_iss)}
            </td>
            <td style={td({ textAlign: "center", padding: "5px" })}>Não</td>
          </tr>
          <tr>
            <td style={subHeader({ textAlign: "right", fontWeight: "bold" })}>ALIQ. CBS</td>
            <td style={subHeader({ textAlign: "right", fontWeight: "bold" })}>VALOR CBS</td>
            <td style={subHeader({ textAlign: "right", fontWeight: "bold" })}>ALIQ. IBS EST.</td>
            <td style={subHeader({ textAlign: "center", fontWeight: "bold" })}>VALOR IBS EST.</td>
          </tr>
          <tr>
            <td style={td({ textAlign: "right", padding: "5px" })}>*****</td>
            <td style={td({ textAlign: "right", padding: "5px" })}>*****</td>
            <td style={td({ textAlign: "right", padding: "5px" })}>*****</td>
            <td style={td({ textAlign: "center", padding: "5px" })}>*****</td>
          </tr>
        </tbody>
      </table>

      {/* ===== CÓDIGOS DO SERVIÇO ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={td({ width: "40%" })}>
              <Field label="Código do Serviço">{codServ} - Tinturaria e lavanderia.</Field>
            </td>
            <td style={td({ width: "20%" })}>
              <Field label="Código NBS">*********</Field>
            </td>
            <td style={td({ width: "20%" })}>
              <Field label="Indicador de Operações">*********</Field>
            </td>
            <td style={td({ width: "20%" })}>
              <Field label="Classificação Tributária">*********</Field>
            </td>
          </tr>
          <tr>
            <td style={td()}>
              <Field label="Código de Tributação Nacional">{codTribNac} - Tinturaria e lavanderia.</Field>
            </td>
            <td colSpan={3} style={td()}>
              <Field label="Código de Tributação Municipal">{codTribMun} - Tinturaria e lavanderia</Field>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== TRIBUTOS LINHA 1 ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={td({ width: "12%" })}><Field label="CIDE">0,00</Field></td>
            <td style={td({ width: "12%" })}><Field label="COFINS Importação">0,00</Field></td>
            <td style={td({ width: "12%" })}><Field label="ICMS">0,00</Field></td>
            <td style={td({ width: "12%" })}><Field label="IOF">0,00</Field></td>
            <td style={td({ width: "12%" })}><Field label="IPI">0,00</Field></td>
            <td style={td({ width: "15%" })}><Field label="PIS/PASEP Importação">0,00</Field></td>
            <td style={td({ width: "25%" })}><Field label="CST – Situação Tributária PIS/COFINS">0 - Nenhum</Field></td>
          </tr>
          <tr>
            <td colSpan={2} style={td()}>
              <Field label="Descrição Contrib. Sociais – Retidas">0 - PIS/COFINS/CSLL Não Retidos</Field>
            </td>
            <td style={td()}><Field label="Contribuições Sociais – Retidas">0,00</Field></td>
            <td style={td()}><Field label="Base Cálculo PIS/COFINS">0,00</Field></td>
            <td style={td()}><Field label="PIS Alíquota">0,00</Field></td>
            <td style={td()}><Field label="PIS – Apuração Própria">0,00</Field></td>
            <td style={td({ padding: 0 })}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ ...td({ borderTop: "none", borderRight: BORDER, borderBottom: "none", borderLeft: "none", width: "50%" }) }}>
                      <Field label="COFINS Alíquota">0,00</Field>
                    </td>
                    <td style={{ ...td({ borderTop: "none", borderRight: "none", borderBottom: "none", borderLeft: "none" }) }}>
                      <Field label="COFINS – Apuração Própria">0,00</Field>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== BASE DE CÁLCULO ISSQN ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={td({ width: "16.6%" })}>
              <Field label="Base Cálculo ISSQN Próprio" bold>{fmt(data.valor_servico)}</Field>
            </td>
            <td style={td({ width: "16.6%" })}>
              <Field label="Valor do ISSQN Próprio" bold>{fmt(data.valor_iss)}</Field>
            </td>
            <td style={td({ width: "16.6%" })}>
              <Field label="Base Cálculo ISSQN Retido">0,00</Field>
            </td>
            <td style={td({ width: "16.6%" })}>
              <Field label="Valor do ISSQN Retido">0,00</Field>
            </td>
            <td style={td({ width: "16.6%" })}>
              <Field label="Valor Total do ISSQN" bold>{fmt(data.valor_iss)}</Field>
            </td>
            <td style={td({ width: "16.6%" })}>
              <Field label="Valor Dedução/Descontos">0,00</Field>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== CBS / IBS ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={td({ width: "20%" })}><Field label="Valor do CBS">*****</Field></td>
            <td style={td({ width: "20%" })}><Field label="Valor do IBS Estadual">*****</Field></td>
            <td style={td({ width: "25%", background: HEADER_BG, fontWeight: "bold", textAlign: "center", verticalAlign: "middle", fontSize: "9.5px" })}>
              Valor total IBS CBS
            </td>
            <td style={td({ width: "35%", verticalAlign: "middle" })}>*****</td>
          </tr>
        </tbody>
      </table>

      {/* ===== VALOR TOTAL / LÍQUIDO ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={td({ width: "30%", padding: "6px" })}>
              <span style={{ ...val, fontSize: "10px" }}>Valor Total da NFS-e</span>
            </td>
            <td style={td({ width: "20%", padding: "6px", textAlign: "left" })}>
              <span style={{ fontSize: "11px", fontWeight: "bold" }}>{fmt(data.valor_servico)}</span>
            </td>
            <td style={td({ width: "30%", padding: "6px" })}>
              <span style={{ ...val, fontSize: "10px" }}>Valor Líquido da NFS-e</span>
            </td>
            <td style={td({ width: "20%", padding: "6px" })}>
              <span style={{ fontSize: "11px", fontWeight: "bold" }}>{fmt(data.valor_servico)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== INFORMAÇÕES ADICIONAIS ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td colSpan={2} style={td({ padding: "4px 6px", borderBottom: "none" })}>
              <span style={lbl}>Informações Adicionais</span>
            </td>
          </tr>
          <tr>
            <td style={td({ padding: "6px 8px", width: "82%", borderTop: "none", height: "70px" })}>
              {isSimples && (
                <div style={{ fontSize: "8.5px" }}>
                  NOTA EMITIDA POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL
                </div>
              )}
              <div style={{ fontSize: "8.5px" }}>NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI</div>
              <div style={{ fontSize: "8.5px" }}>
                Lei 12741/2012: Mun: R${fmt(valorMun)}; Est: R$0,00; Fed: R${fmt(valorFed)}; Total Aprox: R${fmt(valorTotalAprox)}. Fonte: IBPT.
              </div>
              <div style={{ fontSize: "8.5px", marginTop: "2px" }}>
                Campos identificados com **** referem-se a informações de IBS e CBS de preenchimento opcional pelo contribuinte, não informadas na emissão da NFS-e.
              </div>
              {data.informacoes_adicionais && (
                <div style={{ fontSize: "8.5px", marginTop: "4px" }}>{data.informacoes_adicionais}</div>
              )}
            </td>
            <td style={td({ padding: "6px", width: "18%", textAlign: "center", borderTop: "none", verticalAlign: "middle" })}>
              <QRCodeSVG value={qrUrl} size={70} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== BARCODE ===== */}
      <div style={{ padding: "8px 0 4px 0" }}>
        <Barcode value={barcodeValue} />
      </div>

      {/* ===== RECIBO ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={td({ width: "55%", padding: "6px 8px" })}>
              <div style={{ fontSize: "8.5px" }}>
                Recebi(emos) de <strong>{data.emitente.razao_social}</strong>
              </div>
              <div style={{ fontSize: "8.5px" }}>
                os serviços constantes da Nota Fiscal Eletrônica indicada ao lado.
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "12px", alignItems: "flex-end" }}>
                <div style={{ borderTop: "1px solid #000", paddingTop: "2px", fontSize: "7.5px", width: "30%", textAlign: "center" }}>
                  ___/___/_____<br />Data
                </div>
                <div style={{ borderTop: "1px solid #000", paddingTop: "2px", fontSize: "7.5px", width: "65%", textAlign: "center" }}>
                  Identificação e assinatura do recebedor
                </div>
              </div>
            </td>
            <td style={td({ width: "25%", padding: "6px 8px" })}>
              <div style={{ fontSize: "8.5px" }}>Número da NFS-e: <strong>{numero}</strong></div>
              <div style={{ fontSize: "8.5px" }}>Competência: <strong>{data.competencia || dataEmissao}</strong></div>
              <div style={{ fontSize: "8.5px" }}>NFS-e: <strong>{codVerif}</strong></div>
            </td>
            <td style={td({ width: "20%", padding: "6px 8px", textAlign: "center" })}>
              <span style={lbl}>Número de Controle do Município</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== RODAPÉ ===== */}
      <div style={{ marginTop: "6px", fontSize: "7.5px", textAlign: "center" }}>
        Consulta realizada em {dataEmissao} às {horaEmissao}.
      </div>
      <div style={{ fontSize: "7.5px", textAlign: "center", fontWeight: "bold" }}>
        Para consultar a autenticidade acesse: {portalUrl}
      </div>
      <div style={{ fontSize: "7.5px", textAlign: "right", marginTop: "8px" }}>
        Página 1 de 1
      </div>

      {/* Aviso de Prévia */}
      {data.isPrevia && (
        <div
          style={{
            marginTop: "10px",
            padding: "6px",
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "4px",
            textAlign: "center",
            fontSize: "10px",
            fontWeight: "bold",
            color: "#856404",
          }}
        >
          ⚠️ ESTA É UMA PRÉVIA - DOCUMENTO SEM VALOR FISCAL
        </div>
      )}
    </div>
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
    const content = document.getElementById("nfse-preview-oficial");
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>NFS-e - ${data.numero_nf || "Prévia"}</title>
          <style>
            @page { size: A4; margin: 8mm; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
    onPrint?.();
  };

  return (
    <div className="space-y-4">
      {/* Botões de ação */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => setIsFullscreen(true)} className="gap-2">
          <Expand className="w-4 h-4" />
          Tela Cheia
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" />
          Imprimir
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
          <Download className="w-4 h-4" />
          Baixar PDF
        </Button>
      </div>

      {/* Preview */}
      <div className="border rounded-lg overflow-auto max-h-[600px] bg-white">
        <NFSeContent data={data} />
      </div>

      {/* Modal Fullscreen */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto p-0">
          <DialogTitle className="sr-only">Prévia NFS-e em Tela Cheia</DialogTitle>
          <div className="p-4">
            <div className="flex justify-end gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
            </div>
            <NFSeContent data={data} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
