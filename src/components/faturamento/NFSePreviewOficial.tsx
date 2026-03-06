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
}

const formatCurrency = (value: number) => {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatCNPJ = (cnpj: string | null) => {
  if (!cnpj) return "";
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return cnpj;
};

const formatCEP = (cep: string | null) => {
  if (!cep) return "";
  const clean = cep.replace(/\D/g, "");
  if (clean.length === 8) {
    return clean.replace(/(\d{5})(\d{3})/, "$1-$2");
  }
  return cep;
};

// Shared cell style helpers
const cellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: "1px solid #000",
  padding: "4px 8px",
  fontSize: "9px",
  ...extra,
});

const headerCellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: "1px solid #000",
  background: "#e0e0e0",
  padding: "4px 8px",
  fontWeight: "bold",
  fontSize: "10px",
  textAlign: "center" as const,
  ...extra,
});

const labelStyle: React.CSSProperties = {
  fontSize: "8px",
  color: "#666",
  display: "block",
  marginBottom: "1px",
};

const valueStyle: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: "bold",
};

function NFSeContent({ data }: { data: NFSeOficialData }) {
  const endEmitente = data.emitente.endereco;
  const endTomador = data.tomador.endereco;

  const hoje = new Date();
  const dataEmissao = data.data_emissao || hoje.toLocaleDateString("pt-BR");
  const horaEmissao = hoje.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const codigoVerif = data.codigo_verificacao || data.chave_acesso?.slice(-10) || "PREVIA";
  const qrCodeUrl = `https://saoroque.govbr.cloud/nfse.portal/verificar/${codigoVerif}`;

  const aliquotaEfetiva = data.valor_servico > 0 ? ((data.valor_iss / data.valor_servico) * 100) : data.aliquota_iss;

  // Cálculos da Lei 12741/2012 (estimativas)
  const valorMun = data.valor_iss * 0.88;
  const valorFed = data.valor_iss * 2.96;
  const valorTotalAprox = valorMun + valorFed;

  return (
    <div
      id="nfse-preview-oficial"
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "9px",
        color: "#000",
        background: "#fff",
        padding: "10px",
        maxWidth: "210mm",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Marca d'água */}
      {data.isPrevia && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-45deg)",
          fontSize: "60px",
          color: "rgba(200, 0, 0, 0.12)",
          fontWeight: "bold",
          pointerEvents: "none",
          zIndex: 1,
          whiteSpace: "nowrap",
        }}>
          PRÉVIA - SEM VALOR FISCAL
        </div>
      )}

      {/* ===== CABEÇALHO PRINCIPAL ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td colSpan={3} style={{
              border: "1px solid #000",
              background: "#003366",
              color: "#fff",
              textAlign: "center",
              padding: "6px",
              fontSize: "14px",
              fontWeight: "bold",
            }}>
              NFS-e&nbsp;&nbsp;&nbsp;Nota Fiscal de Serviço Eletrônica
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== EMITENTE + NÚMERO + SÉRIE/DATA ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            {/* Emitente */}
            <td style={cellStyle({ verticalAlign: "top", width: "55%", padding: "8px" })}>
              <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>
                {data.emitente.razao_social}
              </div>
              {endEmitente && (
                <>
                  <div style={{ fontSize: "9px" }}>
                    {endEmitente.logradouro}, {endEmitente.numero}
                    {endEmitente.complemento && ` - ${endEmitente.complemento}`}
                  </div>
                  <div style={{ fontSize: "9px" }}>
                    CEP: {formatCEP(endEmitente.cep)} - Bairro: {endEmitente.bairro}
                  </div>
                  <div style={{ fontSize: "9px" }}>
                    Município: {endEmitente.cidade} - {endEmitente.uf}
                  </div>
                </>
              )}
              <div style={{ fontSize: "9px", marginTop: "3px" }}>
                E-mail: {data.emitente.email || "comercial@anjolav.com.br"}
              </div>
              <div style={{ fontSize: "9px" }}>
                Fone: {data.emitente.telefone || "(11) 4784-1281"}
              </div>
              <div style={{ fontSize: "9px", marginTop: "4px" }}>
                <span>CNPJ / CPF: {formatCNPJ(data.emitente.cnpj)}</span>
              </div>
              <div style={{ fontSize: "9px" }}>
                <span>Inscrição Estadual: {data.emitente.inscricao_estadual || "ISENTO"}</span>
              </div>
              <div style={{ fontSize: "9px" }}>
                <span>Inscrição Municipal: {data.emitente.inscricao_municipal || "-"}</span>
              </div>
            </td>
            {/* Número e Série */}
            <td style={cellStyle({ verticalAlign: "top", width: "25%", textAlign: "center", padding: "8px" })}>
              <div style={{ fontSize: "8px", marginBottom: "2px" }}>Número da NFS-e:</div>
              <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "6px" }}>
                {data.numero_nf || "PRÉVIA"}
              </div>
              <div style={{ fontSize: "9px", marginTop: "4px" }}>
                Série da NFS-e: <strong>{data.serie || "NACIONAL"}</strong>
              </div>
              <div style={{ fontSize: "9px", marginTop: "6px" }}>
                Data do Serviço: {dataEmissao}
              </div>
              <div style={{ fontSize: "9px", marginTop: "4px" }}>
                Código Verificador:
              </div>
              <div style={{ fontSize: "10px", fontWeight: "bold" }}>{codigoVerif}</div>
            </td>
            {/* QR Code */}
            <td style={cellStyle({ verticalAlign: "top", width: "20%", textAlign: "center", padding: "8px" })}>
              <QRCodeSVG value={qrCodeUrl} size={85} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== FAIXA PREFEITURA ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({
              background: "#4a4a4a",
              color: "#fff",
              padding: "6px",
              width: "50%",
              verticalAlign: "top",
            })}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  background: "#fff",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "7px",
                  color: "#333",
                  fontWeight: "bold",
                  textAlign: "center",
                  flexShrink: 0,
                }}>
                  BRASÃO
                </div>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "10px" }}>PREFEITURA DA ESTANCIA</div>
                  <div style={{ fontWeight: "bold", fontSize: "10px" }}>TURISTICA DE SAO ROQUE/SP</div>
                  <div style={{ fontSize: "8px" }}>Divisão de Rendas</div>
                  <div style={{ fontSize: "8px" }}>Fone: (11) 4784-8514</div>
                  <div style={{ fontSize: "8px" }}>https://saoroque.govbr.cloud/nfse.portal</div>
                </div>
              </div>
            </td>
            <td style={cellStyle({
              background: "#4a4a4a",
              color: "#fff",
              padding: "6px",
              width: "50%",
              verticalAlign: "top",
              textAlign: "right",
            })}>
              <div style={{ fontSize: "9px" }}>Dt. de Emissão: {dataEmissao} {horaEmissao}</div>
              <div style={{ fontSize: "9px", marginTop: "2px" }}>Exigibilidade ISS: <strong>Exigível</strong></div>
              <div style={{ fontSize: "9px", marginTop: "2px" }}>Município de Prestação Serviço: {endEmitente?.cidade || "São Roque"}/{endEmitente?.uf || "SP"}</div>
              <div style={{ fontSize: "9px", marginTop: "2px" }}>Tributado no Município: {endEmitente?.cidade || "São Roque"}/{endEmitente?.uf || "SP"}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== CHAVE DE ACESSO ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({ background: "#f0f0f0", padding: "6px", width: "70%" })}>
              <div style={{ fontSize: "9px", fontWeight: "bold" }}>Chave de Acesso da NFS-e</div>
              <div style={{ fontSize: "11px", fontFamily: "monospace", letterSpacing: "1px", marginTop: "2px" }}>
                {data.chave_acesso || "35506051223227029000106000000000003826015784052098"}
              </div>
            </td>
            <td style={cellStyle({ background: "#f0f0f0", padding: "6px", width: "30%", fontSize: "9px" })}>
              <div>Número DPS: {data.numero_dps || data.numero_nf || "PRÉVIA"}</div>
              <div>Série DPS: {data.serie_dps || "49999"}</div>
              <div>Data e hora de Emissão da DPS: {data.data_hora_dps || `${dataEmissao} ${horaEmissao}`}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== TOMADOR DO SERVIÇO ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td colSpan={4} style={headerCellStyle()}>TOMADOR DO SERVIÇO</td>
          </tr>
          <tr>
            {/* Coluna esquerda: Nome + Endereço + Cidade */}
            <td colSpan={2} style={cellStyle({ width: "60%", verticalAlign: "top", padding: "6px" })}>
              <div>
                <span style={labelStyle}>Nome / Razão Social:</span>
                <span style={valueStyle}>{data.tomador.razao_social}</span>
              </div>
              {endTomador && (
                <>
                  <div style={{ marginTop: "3px" }}>
                    <span style={labelStyle}>Endereço:</span>
                    <span style={{ fontSize: "9px" }}>
                      {endTomador.logradouro}, {endTomador.numero}
                      {endTomador.complemento && ` - ${endTomador.complemento}`}
                    </span>
                  </div>
                  <div style={{ marginTop: "3px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <div>
                      <span style={labelStyle}>Cidade:</span>
                      <span style={{ fontSize: "9px" }}>{endTomador.cidade}</span>
                    </div>
                    <div>
                      <span style={labelStyle}>UF:</span>
                      <span style={{ fontSize: "9px" }}>{endTomador.uf}</span>
                    </div>
                    <div>
                      <span style={labelStyle}>Bairro:</span>
                      <span style={{ fontSize: "9px" }}>{endTomador.bairro}</span>
                    </div>
                    <div>
                      <span style={labelStyle}>CEP:</span>
                      <span style={{ fontSize: "9px" }}>{formatCEP(endTomador.cep)}</span>
                    </div>
                  </div>
                </>
              )}
            </td>
            {/* Coluna direita: CNPJ + IM + IE + Email + Fone */}
            <td colSpan={2} style={cellStyle({ width: "40%", verticalAlign: "top", padding: "6px" })}>
              <div>
                <span style={labelStyle}>CNPJ / CPF:</span>
                <span style={valueStyle}>{formatCNPJ(data.tomador.cpf_cnpj) || "-"}</span>
              </div>
              <div style={{ marginTop: "3px" }}>
                <span style={labelStyle}>Inscrição Municipal:</span>
                <span style={{ fontSize: "9px" }}>{data.tomador.inscricao_municipal || "-"}</span>
              </div>
              <div style={{ marginTop: "3px" }}>
                <span style={labelStyle}>Inscrição Estadual:</span>
                <span style={{ fontSize: "9px" }}>{data.tomador.inscricao_estadual || "-"}</span>
              </div>
              <div style={{ marginTop: "3px" }}>
                <span style={labelStyle}>E-mail:</span>
                <span style={{ fontSize: "9px" }}>{data.tomador.email || "-"}</span>
              </div>
              <div style={{ marginTop: "3px" }}>
                <span style={labelStyle}>Fone:</span>
                <span style={{ fontSize: "9px" }}>{data.tomador.telefone || "-"}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== INTERMEDIÁRIO DO SERVIÇO ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td colSpan={5} style={headerCellStyle()}>INTERMEDIÁRIO DO SERVIÇO</td>
          </tr>
          <tr>
            <td style={cellStyle({ fontSize: "9px" })}><span style={labelStyle}>Nome / Razão Social:</span> *****</td>
            <td style={cellStyle({ fontSize: "9px" })}><span style={labelStyle}>CNPJ / CPF:</span> *****</td>
            <td style={cellStyle({ fontSize: "9px" })}><span style={labelStyle}>Inscrição Municipal:</span> *****</td>
            <td style={cellStyle({ fontSize: "9px" })}><span style={labelStyle}>E-mail:</span> *****</td>
            <td style={cellStyle({ fontSize: "9px" })}><span style={labelStyle}>Fone:</span> *****</td>
          </tr>
        </tbody>
      </table>

      {/* ===== DESCRIÇÃO DOS SERVIÇOS ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td colSpan={5} style={headerCellStyle()}>DESCRIÇÃO DOS SERVIÇOS</td>
          </tr>
          <tr>
            <th style={cellStyle({ fontSize: "8px", background: "#f5f5f5", textAlign: "left", width: "50%" })}>DESCRIÇÃO</th>
            <th style={cellStyle({ fontSize: "8px", background: "#f5f5f5", textAlign: "right" })}>VALOR TOTAL</th>
            <th style={cellStyle({ fontSize: "8px", background: "#f5f5f5", textAlign: "right" })}>ALIQ. ISSQN</th>
            <th style={cellStyle({ fontSize: "8px", background: "#f5f5f5", textAlign: "right" })}>VALOR ISSQN</th>
            <th style={cellStyle({ fontSize: "8px", background: "#f5f5f5", textAlign: "center" })}>RETIDO</th>
          </tr>
          <tr>
            <td style={cellStyle({ padding: "8px", verticalAlign: "top", minHeight: "60px" })}>
              <div style={{ whiteSpace: "pre-wrap" }}>{data.descricao_servico}</div>
              <div style={{ marginTop: "8px", fontSize: "8px", color: "#666" }}>
                Alíquota Efetiva: {aliquotaEfetiva.toFixed(7)}%
              </div>
            </td>
            <td style={cellStyle({ padding: "8px", fontSize: "10px", textAlign: "right", fontWeight: "bold", verticalAlign: "top" })}>
              {formatCurrency(data.valor_servico)}
            </td>
            <td style={cellStyle({ padding: "8px", fontSize: "10px", textAlign: "right", verticalAlign: "top" })}>
              {data.aliquota_iss?.toFixed(2)}
            </td>
            <td style={cellStyle({ padding: "8px", fontSize: "10px", textAlign: "right", fontWeight: "bold", verticalAlign: "top" })}>
              {formatCurrency(data.valor_iss)}
            </td>
            <td style={cellStyle({ padding: "8px", fontSize: "10px", textAlign: "center", verticalAlign: "top" })}>
              Não
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== INFORMAÇÕES FISCAIS ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td colSpan={3} style={headerCellStyle()}>Informações Fiscais</td>
          </tr>
          <tr>
            <td colSpan={3} style={cellStyle({ fontSize: "9px" })}>
              <strong>Código do Serviço:</strong> {data.emitente.codigo_servico || "14.10"} - Tinturaria e lavanderia.
            </td>
          </tr>
          <tr>
            <td colSpan={3} style={cellStyle({ fontSize: "9px" })}>
              <strong>Código de Tributação Nacional:</strong> {data.codigo_tributacao_nacional || "14.10.01"} - Tinturaria e lavanderia.
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== IMPOSTOS - Linha 1: CIDE, COFINS, COFINS Imp, ICMS ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5", width: "25%" })}><strong>CIDE</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5", width: "25%" })}><strong>COFINS</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5", width: "25%" })}><strong>COFINS Importação</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5", width: "25%" })}><strong>ICMS</strong></td>
          </tr>
          <tr>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>0,00</td>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>0,00</td>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>0,00</td>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>0,00</td>
          </tr>
        </tbody>
      </table>

      {/* ===== VALORES ISSQN - Linha 1: Base Próprio, Valor Próprio, Base Retido ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Base Cálculo ISSQN Próprio</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Valor do ISSQN Próprio</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Base Cálculo ISSQN Retido</strong></td>
          </tr>
          <tr>
            <td style={cellStyle({ fontSize: "10px", textAlign: "center", fontWeight: "bold" })}>{formatCurrency(data.valor_servico)}</td>
            <td style={cellStyle({ fontSize: "10px", textAlign: "center", fontWeight: "bold" })}>{formatCurrency(data.valor_iss)}</td>
            <td style={cellStyle({ fontSize: "10px", textAlign: "center" })}>0,00</td>
          </tr>
        </tbody>
      </table>

      {/* ===== CBS/IBS ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Valor do CBS</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Valor do IBS Estadual</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Valor total IBS CBS</strong></td>
          </tr>
          <tr>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>*****</td>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>*****</td>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}></td>
          </tr>
        </tbody>
      </table>

      {/* ===== VALOR TOTAL / LÍQUIDO ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({
              fontSize: "11px",
              fontWeight: "bold",
              textAlign: "center",
              width: "50%",
              background: "#e8f4e8",
              padding: "8px",
            })}>
              Valor Total da NFS-e: R$ {formatCurrency(data.valor_servico)}
            </td>
            <td style={cellStyle({
              fontSize: "11px",
              fontWeight: "bold",
              textAlign: "center",
              width: "50%",
              background: "#e8f4e8",
              padding: "8px",
            })}>
              Valor Líquido da NFS-e: R$ {formatCurrency(data.valor_servico)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== INFORMAÇÕES FISCAIS - Continuação ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Código NBS</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Indicador de Operações</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Classificação Tributária</strong></td>
          </tr>
          <tr>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>*********</td>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>*********</td>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>*********</td>
          </tr>
        </tbody>
      </table>

      {/* ===== CÓDIGO TRIBUTAÇÃO MUNICIPAL ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({ fontSize: "9px" })}>
              <strong>Código de Tributação Municipal:</strong> {data.codigo_tributacao_municipal || "1410"} - Tinturaria e lavanderia
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== IMPOSTOS - Linha 2: IOF, IPI, PIS/PASEP, PIS/PASEP Imp ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5", width: "25%" })}><strong>IOF</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5", width: "25%" })}><strong>IPI</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5", width: "25%" })}><strong>PIS/PASEP</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5", width: "25%" })}><strong>PIS/PASEP Importação</strong></td>
          </tr>
          <tr>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>0,00</td>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>0,00</td>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>0,00</td>
            <td style={cellStyle({ fontSize: "9px", textAlign: "center" })}>0,00</td>
          </tr>
        </tbody>
      </table>

      {/* ===== VALORES ISSQN RETIDO + TOTAL + DEDUÇÃO ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Valor do ISSQN Retido</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Valor Total do ISSQN</strong></td>
            <td style={cellStyle({ fontSize: "8px", textAlign: "center", background: "#f5f5f5" })}><strong>Valor Dedução/Descontos</strong></td>
          </tr>
          <tr>
            <td style={cellStyle({ fontSize: "10px", textAlign: "center" })}>0,00</td>
            <td style={cellStyle({ fontSize: "10px", textAlign: "center", fontWeight: "bold" })}>{formatCurrency(data.valor_iss)}</td>
            <td style={cellStyle({ fontSize: "10px", textAlign: "center" })}>0,00</td>
          </tr>
        </tbody>
      </table>

      {/* ===== INFORMAÇÕES ADICIONAIS ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td colSpan={2} style={headerCellStyle()}>Informações Adicionais</td>
          </tr>
          <tr>
            <td style={cellStyle({ padding: "8px", verticalAlign: "top", width: "85%" })}>
              <div style={{ fontSize: "9px" }}>NOTA EMITIDA POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL</div>
              <div style={{ fontSize: "9px" }}>NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI</div>
              <div style={{ fontSize: "9px", marginTop: "4px" }}>
                Lei 12741/2012: Mun: R${formatCurrency(valorMun)}; Est: R$0,00; Fed: R${formatCurrency(valorFed)}; Total Aprox: R${formatCurrency(valorTotalAprox)}. Fonte: IBPT.
              </div>
              <div style={{ fontSize: "8px", marginTop: "4px", color: "#666" }}>
                Campos identificados com **** referem-se a informações de IBS e CBS de preenchimento opcional pelo contribuinte, não informadas na emissão da NFS-e.
              </div>
            </td>
            <td style={cellStyle({ padding: "8px", textAlign: "center", verticalAlign: "middle", width: "15%" })}>
              <QRCodeSVG value={qrCodeUrl} size={65} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== RECIBO ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={cellStyle({ padding: "8px", width: "45%", verticalAlign: "top", fontSize: "9px" })}>
              <div>Recebi(emos) de <strong>{data.emitente.razao_social}</strong></div>
              <div style={{ marginTop: "24px", borderTop: "1px solid #000", width: "80%", paddingTop: "4px", fontSize: "8px" }}>
                ___/___/_______ &nbsp;&nbsp;&nbsp; Data
              </div>
              <div style={{ fontSize: "8px", marginTop: "2px" }}>Identificação e assinatura do recebedor</div>
            </td>
            <td style={cellStyle({ padding: "8px", width: "30%", verticalAlign: "top", fontSize: "9px" })}>
              <div>Número da NFS-e: <strong>{data.numero_nf || "PRÉVIA"}</strong></div>
              <div style={{ marginTop: "4px" }}>Competência: {dataEmissao}</div>
            </td>
            <td style={cellStyle({ padding: "8px", width: "25%", verticalAlign: "top", fontSize: "9px" })}>
              <div style={{ fontSize: "8px", color: "#666" }}>Número de Controle do Município</div>
              <div style={{ marginTop: "4px" }}>NFS-e: {codigoVerif}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== RODAPÉ ===== */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={cellStyle({ padding: "4px 8px", fontSize: "8px", background: "#f0f0f0" })}>
              <div>Consulta realizada em {dataEmissao} às {horaEmissao}.</div>
              <div>Para consultar a autenticidade acesse: https://saoroque.govbr.cloud/nfse.portal</div>
            </td>
            <td style={cellStyle({ padding: "4px 8px", fontSize: "8px", background: "#f0f0f0", textAlign: "right" })}>
              Página 1 de 1
            </td>
          </tr>
        </tbody>
      </table>

      {/* Aviso de Prévia */}
      {data.isPrevia && (
        <div style={{
          marginTop: "10px",
          padding: "8px",
          background: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: "4px",
          textAlign: "center",
          fontSize: "10px",
          fontWeight: "bold",
          color: "#856404",
        }}>
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
            @page { size: A4; margin: 10mm; }
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
