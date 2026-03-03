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

function NFSeContent({ data }: { data: NFSeOficialData }) {
  const endEmitente = data.emitente.endereco;
  const endTomador = data.tomador.endereco;
  
  const hoje = new Date();
  const dataEmissao = data.data_emissao || hoje.toLocaleDateString("pt-BR");
  const horaEmissao = hoje.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const codigoVerif = data.codigo_verificacao || data.chave_acesso?.slice(-10) || "PREVIA";
  const qrCodeUrl = `https://webapp1-saoroque.cidade360.cloud/nfse.portal/verificar/${codigoVerif}`;
  
  const aliquotaEfetiva = data.valor_servico > 0 ? ((data.valor_iss / data.valor_servico) * 100) : data.aliquota_iss;

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
        margin: "0 auto"
      }}
    >
      {/* Marca d'água para prévia */}
      {data.isPrevia && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-45deg)",
          fontSize: "60px",
          color: "rgba(200, 0, 0, 0.15)",
          fontWeight: "bold",
          pointerEvents: "none",
          zIndex: 1,
          whiteSpace: "nowrap"
        }}>
          PRÉVIA - SEM VALOR FISCAL
        </div>
      )}

      {/* ============ CABEÇALHO PRINCIPAL ============ */}
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
              fontWeight: "bold"
            }}>
              NFS-e&nbsp;&nbsp;&nbsp;Nota Fiscal de Serviço Eletrônica
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ EMITENTE + NÚMERO + QR CODE ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            {/* Emitente */}
            <td style={{ 
              border: "1px solid #000", 
              padding: "8px", 
              verticalAlign: "top",
              width: "55%"
            }}>
              <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>
                {data.emitente.razao_social}
              </div>
              {endEmitente && (
                <>
                  <div style={{ fontSize: "9px" }}>
                    {endEmitente.logradouro}, {endEmitente.numero}
                    {endEmitente.complemento && ` ${endEmitente.complemento}`}
                  </div>
                  <div style={{ fontSize: "9px" }}>
                    CEP: {formatCEP(endEmitente.cep)} {endEmitente.bairro}
                  </div>
                  <div style={{ fontSize: "9px" }}>
                    Município: {endEmitente.cidade}-{endEmitente.uf}
                  </div>
                </>
              )}
              <div style={{ fontSize: "9px", marginTop: "4px" }}>
                E-mail: {data.emitente.email || "-"} / Fone: {data.emitente.telefone || "-"}
              </div>
              <div style={{ fontSize: "9px", marginTop: "4px" }}>
                CNPJ: {formatCNPJ(data.emitente.cnpj)} | IE: {data.emitente.inscricao_estadual || "-"} | IM: {data.emitente.inscricao_municipal || "-"}
              </div>
            </td>
            {/* Número da NF */}
            <td style={{ 
              border: "1px solid #000", 
              padding: "8px", 
              verticalAlign: "top",
              width: "25%",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "9px", marginBottom: "4px" }}>Número NFS-e:</div>
              <div style={{ fontWeight: "bold", fontSize: "16px" }}>{data.numero_nf || "PRÉVIA"}</div>
              <div style={{ fontSize: "9px", marginTop: "6px" }}>Série: {data.serie || "NACIONAL"}</div>
              <div style={{ fontSize: "9px", marginTop: "6px" }}>Data Serviço: {dataEmissao}</div>
            </td>
            {/* QR Code */}
            <td style={{ 
              border: "1px solid #000", 
              padding: "8px", 
              verticalAlign: "top",
              width: "20%",
              textAlign: "center"
            }}>
              <QRCodeSVG value={qrCodeUrl} size={80} />
              <div style={{ fontSize: "8px", marginTop: "4px" }}>Código Verif.</div>
              <div style={{ fontSize: "9px", fontWeight: "bold" }}>{codigoVerif}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ FAIXA PREFEITURA ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ 
              border: "1px solid #000", 
              background: "#4a4a4a", 
              color: "#fff",
              padding: "6px",
              width: "50%",
              verticalAlign: "top"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ 
                  width: "40px", 
                  height: "40px", 
                  background: "#fff", 
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "8px",
                  color: "#333",
                  fontWeight: "bold",
                  textAlign: "center"
                }}>
                  BRASÃO
                </div>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "10px" }}>PREFEITURA DA ESTÂNCIA</div>
                  <div style={{ fontWeight: "bold", fontSize: "10px" }}>TURÍSTICA DE SÃO ROQUE/SP</div>
                  <div style={{ fontSize: "8px" }}>Divisão de Rendas</div>
                  <div style={{ fontSize: "8px" }}>Fone: (11) 4784-8282 - www.saoroque.sp.gov.br</div>
                </div>
              </div>
            </td>
            <td style={{ 
              border: "1px solid #000", 
              background: "#4a4a4a", 
              color: "#fff",
              padding: "6px",
              width: "50%",
              verticalAlign: "top",
              textAlign: "right"
            }}>
              <div style={{ fontSize: "9px" }}>Dt.Emissão: {dataEmissao} {horaEmissao}</div>
              <div style={{ fontSize: "9px", marginTop: "2px" }}>Exigibilidade ISS: <strong>Exigível</strong></div>
              <div style={{ fontSize: "9px", marginTop: "2px" }}>Município Prestação: {endEmitente?.cidade || "São Roque"}/SP</div>
              <div style={{ fontSize: "9px", marginTop: "2px" }}>Tributado no Município: {endEmitente?.cidade || "São Roque"}/SP</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ CHAVE DE ACESSO ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ 
              border: "1px solid #000", 
              background: "#f0f0f0",
              padding: "6px",
              width: "70%"
            }}>
              <div style={{ fontSize: "9px", fontWeight: "bold" }}>Chave de Acesso da NFS-e</div>
              <div style={{ fontSize: "11px", fontFamily: "monospace", letterSpacing: "1px", marginTop: "2px" }}>
                {data.chave_acesso || "35506051223227029000106000000000003826015784052098"}
              </div>
            </td>
            <td style={{ 
              border: "1px solid #000", 
              background: "#f0f0f0",
              padding: "6px",
              width: "30%",
              fontSize: "9px"
            }}>
              <div>Número DPS: {data.numero_dps || data.numero_nf || "PRÉVIA"}</div>
              <div>Série DPS: {data.serie_dps || "49999"}</div>
              <div>Data/Hora DPS: {data.data_hora_dps || `${dataEmissao} ${horaEmissao}`}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ TOMADOR DO SERVIÇO ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td colSpan={2} style={{ 
              border: "1px solid #000", 
              background: "#e0e0e0",
              padding: "4px 8px",
              fontWeight: "bold",
              fontSize: "10px",
              textAlign: "center"
            }}>
              TOMADOR DO SERVIÇO
            </td>
          </tr>
          <tr>
            <td style={{ 
              border: "1px solid #000", 
              padding: "6px",
              width: "60%",
              verticalAlign: "top"
            }}>
              <div style={{ fontSize: "9px" }}>
                <strong>Nome/Razão Social:</strong> {data.tomador.razao_social}
              </div>
              {endTomador && (
                <>
                  <div style={{ fontSize: "9px", marginTop: "2px" }}>
                    <strong>Endereço:</strong> {endTomador.logradouro}, {endTomador.numero}
                    {endTomador.complemento && ` ${endTomador.complemento}`}
                  </div>
                  <div style={{ fontSize: "9px", marginTop: "2px" }}>
                    <strong>Cidade:</strong> {endTomador.cidade} | <strong>UF:</strong> {endTomador.uf} | <strong>Bairro:</strong> {endTomador.bairro}
                  </div>
                </>
              )}
            </td>
            <td style={{ 
              border: "1px solid #000", 
              padding: "6px",
              width: "40%",
              verticalAlign: "top"
            }}>
              <div style={{ fontSize: "9px" }}>
                <strong>CNPJ/CPF:</strong> {data.tomador.cpf_cnpj || "-"}
              </div>
              <div style={{ fontSize: "9px", marginTop: "2px" }}>
                <strong>Insc.Mun:</strong> {data.tomador.inscricao_municipal || "-"}
              </div>
              <div style={{ fontSize: "9px", marginTop: "2px" }}>
                <strong>Insc.Est:</strong> {data.tomador.inscricao_estadual || "-"}
              </div>
              {endTomador && (
                <div style={{ fontSize: "9px", marginTop: "2px" }}>
                  <strong>CEP:</strong> {formatCEP(endTomador.cep)}
                </div>
              )}
              <div style={{ fontSize: "9px", marginTop: "2px" }}>
                <strong>E-mail:</strong> {data.tomador.email || "-"} | <strong>Fone:</strong> {data.tomador.telefone || "-"}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ INTERMEDIÁRIO DO SERVIÇO ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td colSpan={4} style={{ 
              border: "1px solid #000", 
              background: "#e0e0e0",
              padding: "4px 8px",
              fontWeight: "bold",
              fontSize: "10px",
              textAlign: "center"
            }}>
              INTERMEDIÁRIO DO SERVIÇO
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "9px" }}>
              <strong>Nome:</strong> *****
            </td>
            <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "9px" }}>
              <strong>CNPJ/CPF:</strong> *****
            </td>
            <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "9px" }}>
              <strong>Insc.Mun:</strong> *****
            </td>
            <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "9px" }}>
              <strong>Email/Fone:</strong> *****
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ DESCRIÇÃO DOS SERVIÇOS ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td colSpan={5} style={{ 
              border: "1px solid #000", 
              background: "#e0e0e0",
              padding: "4px 8px",
              fontWeight: "bold",
              fontSize: "10px",
              textAlign: "center"
            }}>
              DESCRIÇÃO DOS SERVIÇOS
            </td>
          </tr>
          <tr>
            <th style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", background: "#f5f5f5" }}>
              DESCRIÇÃO
            </th>
            <th style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", background: "#f5f5f5", textAlign: "right" }}>
              VALOR
            </th>
            <th style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", background: "#f5f5f5", textAlign: "right" }}>
              ALÍQ.
            </th>
            <th style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", background: "#f5f5f5", textAlign: "right" }}>
              ISSQN
            </th>
            <th style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", background: "#f5f5f5", textAlign: "center" }}>
              RETIDO
            </th>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "8px", fontSize: "9px", verticalAlign: "top", minHeight: "60px" }}>
              <div style={{ whiteSpace: "pre-wrap" }}>{data.descricao_servico}</div>
              <div style={{ marginTop: "8px", fontSize: "8px", color: "#666" }}>
                Alíquota Efetiva: {aliquotaEfetiva.toFixed(7)}%
              </div>
            </td>
            <td style={{ border: "1px solid #000", padding: "8px", fontSize: "10px", textAlign: "right", fontWeight: "bold", verticalAlign: "top" }}>
              {formatCurrency(data.valor_servico)}
            </td>
            <td style={{ border: "1px solid #000", padding: "8px", fontSize: "10px", textAlign: "right", verticalAlign: "top" }}>
              {data.aliquota_iss?.toFixed(2)}%
            </td>
            <td style={{ border: "1px solid #000", padding: "8px", fontSize: "10px", textAlign: "right", fontWeight: "bold", verticalAlign: "top" }}>
              {formatCurrency(data.valor_iss)}
            </td>
            <td style={{ border: "1px solid #000", padding: "8px", fontSize: "10px", textAlign: "center", verticalAlign: "top" }}>
              Não
            </td>
          </tr>
          {/* Linha CBS/IBS */}
          <tr>
            <td colSpan={5} style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "8px", background: "#f9f9f9" }}>
              CBS: ***** | IBS UF: ***** | IBS Mun: ***** | IS: ***** | Vlr CBS: ***** | Vlr IBS UF: ***** | Vlr IBS Mun: ***** | Vlr IS: *****
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ INFORMAÇÕES FISCAIS ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "8px", width: "50%" }}>
              <strong>Código Serviço:</strong> {data.emitente.codigo_servico || "14.10"} - Tinturaria e lavanderia
            </td>
            <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "8px", width: "50%" }}>
              <strong>Código NBS:</strong> ******
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "8px" }}>
              <strong>Código Tributação Nacional:</strong> {data.codigo_tributacao_nacional || "14.10.01"}
            </td>
            <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "8px" }}>
              <strong>Indicador Op:</strong> ******
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "8px" }}>
              <strong>Código Tributação Municipal:</strong> {data.codigo_tributacao_municipal || "1410"}
            </td>
            <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "8px" }}>
              <strong>Classificação:</strong> ******
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ IMPOSTOS ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", textAlign: "center", background: "#f5f5f5" }}><strong>CIDE</strong></td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", textAlign: "center", background: "#f5f5f5" }}><strong>COFINS</strong></td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", textAlign: "center", background: "#f5f5f5" }}><strong>COFINS Imp</strong></td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", textAlign: "center", background: "#f5f5f5" }}><strong>ICMS</strong></td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", textAlign: "center", background: "#f5f5f5" }}><strong>IOF</strong></td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", textAlign: "center", background: "#f5f5f5" }}><strong>IPI</strong></td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", textAlign: "center", background: "#f5f5f5" }}><strong>PIS</strong></td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "8px", textAlign: "center", background: "#f5f5f5" }}><strong>PIS Imp</strong></td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "9px", textAlign: "center" }}>0,00</td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "9px", textAlign: "center" }}>0,00</td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "9px", textAlign: "center" }}>0,00</td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "9px", textAlign: "center" }}>0,00</td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "9px", textAlign: "center" }}>0,00</td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "9px", textAlign: "center" }}>0,00</td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "9px", textAlign: "center" }}>0,00</td>
            <td style={{ border: "1px solid #000", padding: "4px", fontSize: "9px", textAlign: "center" }}>0,00</td>
          </tr>
        </tbody>
      </table>

      {/* ============ VALORES ISSQN ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #000", padding: "6px", fontSize: "9px", textAlign: "center", width: "25%" }}>
              <div><strong>Base Cálc. ISSQN</strong></div>
              <div style={{ fontSize: "11px", fontWeight: "bold", marginTop: "2px" }}>{formatCurrency(data.valor_servico)}</div>
            </td>
            <td style={{ border: "1px solid #000", padding: "6px", fontSize: "9px", textAlign: "center", width: "25%" }}>
              <div><strong>Valor ISSQN</strong></div>
              <div style={{ fontSize: "11px", fontWeight: "bold", marginTop: "2px" }}>{formatCurrency(data.valor_iss)}</div>
            </td>
            <td style={{ border: "1px solid #000", padding: "6px", fontSize: "9px", textAlign: "center", width: "25%" }}>
              <div><strong>Base Retido</strong></div>
              <div style={{ fontSize: "11px", marginTop: "2px" }}>0,00</div>
            </td>
            <td style={{ border: "1px solid #000", padding: "6px", fontSize: "9px", textAlign: "center", width: "25%" }}>
              <div><strong>Valor Retido</strong></div>
              <div style={{ fontSize: "11px", marginTop: "2px" }}>0,00</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ VALOR TOTAL ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ 
              border: "1px solid #000", 
              padding: "8px", 
              fontSize: "11px", 
              fontWeight: "bold",
              textAlign: "center",
              width: "50%",
              background: "#e8f4e8"
            }}>
              Valor Total NFS-e: R$ {formatCurrency(data.valor_servico)}
            </td>
            <td style={{ 
              border: "1px solid #000", 
              padding: "8px", 
              fontSize: "11px", 
              fontWeight: "bold",
              textAlign: "center",
              width: "50%",
              background: "#e8f4e8"
            }}>
              Valor Líquido NFS-e: R$ {formatCurrency(data.valor_servico)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ INFORMAÇÕES ADICIONAIS ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ 
              border: "1px solid #000", 
              padding: "8px",
              fontSize: "8px",
              verticalAlign: "top",
              width: "85%"
            }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Informações Adicionais</div>
              <div>NOTA EMITIDA POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL</div>
              <div>NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI</div>
              <div style={{ marginTop: "4px" }}>
                Lei 12741/2012: Mun: R${formatCurrency(data.valor_iss * 0.9)}; Est: R$0,00; Fed: R${formatCurrency(data.valor_iss * 3)}: Total: R${formatCurrency(data.valor_iss * 4)}
              </div>
            </td>
            <td style={{ 
              border: "1px solid #000", 
              padding: "8px",
              textAlign: "center",
              verticalAlign: "middle",
              width: "15%"
            }}>
              <QRCodeSVG value={qrCodeUrl} size={60} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ CÓDIGO DE BARRAS SIMULADO ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ 
              border: "1px solid #000", 
              padding: "10px",
              textAlign: "center"
            }}>
              {/* Código de barras simulado com CSS */}
              <div style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center",
                gap: "1px",
                height: "40px",
                marginBottom: "4px"
              }}>
                {Array.from({ length: 80 }).map((_, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      width: i % 3 === 0 ? "2px" : "1px", 
                      height: "100%", 
                      background: "#000" 
                    }} 
                  />
                ))}
              </div>
              <div style={{ fontSize: "10px", fontFamily: "monospace" }}>
                {data.numero_nf || "38"}{codigoVerif}{data.emitente.cnpj?.replace(/\D/g, "") || "23227029000106"}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ RECIBO ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ 
              border: "1px solid #000", 
              padding: "8px",
              width: "60%",
              verticalAlign: "top",
              fontSize: "9px"
            }}>
              <div>Recebi(emos) de <strong>{data.emitente.razao_social}</strong></div>
              <div>os serviços constantes da Nota Fiscal Eletrônica acima</div>
              <div style={{ marginTop: "20px", borderTop: "1px solid #000", width: "80%", paddingTop: "4px" }}>
                ___/___/_______ - Assinatura do recebedor
              </div>
            </td>
            <td style={{ 
              border: "1px solid #000", 
              padding: "8px",
              width: "40%",
              verticalAlign: "top",
              fontSize: "9px",
              textAlign: "right"
            }}>
              <div>Número NFS-e: <strong>{data.numero_nf || "PRÉVIA"}</strong></div>
              <div>Competência: {dataEmissao}</div>
              <div>NFS-e: {codigoVerif}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ============ RODAPÉ ============ */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ 
              border: "1px solid #000", 
              padding: "4px 8px",
              fontSize: "8px",
              background: "#f0f0f0"
            }}>
              Consulta: https://webapp1-saoroque.cidade360.cloud/nfse.portal
            </td>
            <td style={{ 
              border: "1px solid #000", 
              padding: "4px 8px",
              fontSize: "8px",
              background: "#f0f0f0",
              textAlign: "right"
            }}>
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
          color: "#856404"
        }}>
          ⚠️ ESTA É UMA PRÉVIA - DOCUMENTO SEM VALOR FISCAL
        </div>
      )}
    </div>
  );
}

export function NFSePreviewOficial({ 
  data,
  onPrint 
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
