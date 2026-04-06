// Validações fiscais para CPF/CNPJ, CEP e outros dados

/**
 * Valida dígitos verificadores de CPF
 */
export function validarCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Valida primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cleaned.charAt(9))) return false;
  
  // Valida segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

/**
 * Valida dígitos verificadores de CNPJ
 */
export function validarCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  
  if (cleaned.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Valida primeiro dígito verificador
  let tamanho = cleaned.length - 2;
  let numeros = cleaned.substring(0, tamanho);
  const digitos = cleaned.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;
  
  // Valida segundo dígito verificador
  tamanho = tamanho + 1;
  numeros = cleaned.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;
  
  return true;
}

/**
 * Valida CPF ou CNPJ
 */
export function validarCpfCnpj(documento: string): { valid: boolean; tipo: 'cpf' | 'cnpj' | null; erro?: string } {
  const cleaned = documento.replace(/\D/g, '');
  
  if (!cleaned) {
    return { valid: false, tipo: null, erro: 'Documento não informado' };
  }
  
  if (cleaned.length === 11) {
    const valid = validarCPF(cleaned);
    return { valid, tipo: 'cpf', erro: valid ? undefined : 'CPF inválido' };
  }
  
  if (cleaned.length === 14) {
    const valid = validarCNPJ(cleaned);
    return { valid, tipo: 'cnpj', erro: valid ? undefined : 'CNPJ inválido' };
  }
  
  return { valid: false, tipo: null, erro: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos' };
}

/**
 * Valida formato de CEP (8 dígitos)
 */
export function validarCEP(cep: string): boolean {
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.length === 8;
}

/**
 * Formata CPF para exibição
 */
export function formatarCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ para exibição
 */
export function formatarCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CEP para exibição
 */
export function formatarCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
}

/**
 * Naturezas de operação para NFS-e
 */
export const NATUREZAS_OPERACAO = [
  { value: 'tributacao_municipio', label: 'Tributação no Município', descricao: 'Serviço prestado no mesmo município do prestador' },
  { value: 'tributacao_fora', label: 'Tributação Fora do Município', descricao: 'Serviço prestado em município diferente' },
  { value: 'isencao', label: 'Isenção', descricao: 'Serviço isento de ISS' },
  { value: 'imune', label: 'Imune', descricao: 'Prestador imune ao ISS' },
  { value: 'exigibilidade_suspensa', label: 'Exigibilidade Suspensa', descricao: 'Exigibilidade suspensa por decisão judicial' },
  { value: 'exportacao', label: 'Exportação de Serviços', descricao: 'Serviço prestado para o exterior' },
] as const;

export type NaturezaOperacao = typeof NATUREZAS_OPERACAO[number]['value'];

/**
 * Modos de emissão de NFS-e
 */
export const MODOS_EMISSAO = [
  { value: 'simulacao', label: 'Simulação', descricao: 'Apenas prévia, sem envio para prefeitura', cor: 'bg-gray-500' },
  { value: 'homologacao', label: 'Homologação', descricao: 'Ambiente de testes da prefeitura', cor: 'bg-amber-500' },
  { value: 'producao', label: 'Produção', descricao: 'Emissão real de notas fiscais', cor: 'bg-green-500' },
] as const;

export type ModoEmissao = typeof MODOS_EMISSAO[number]['value'];

/**
 * Status possíveis da NFS-e na prefeitura
 */
export const STATUS_SEFAZ = [
  { value: 'nao_enviada', label: 'Não Enviada', cor: 'secondary' },
  { value: 'processando', label: 'Processando', cor: 'warning' },
  { value: 'autorizada', label: 'Autorizada', cor: 'success' },
  { value: 'rejeitada', label: 'Rejeitada', cor: 'destructive' },
  { value: 'cancelada', label: 'Cancelada', cor: 'danger' },
] as const;

export type StatusSefaz = typeof STATUS_SEFAZ[number]['value'];

/**
 * Lista de códigos IBGE de municípios de SP (principais)
 */
export const MUNICIPIOS_SP = [
  { codigo: '3554003', nome: 'São Roque', uf: 'SP' },
  { codigo: '3550308', nome: 'São Paulo', uf: 'SP' },
  { codigo: '3509502', nome: 'Campinas', uf: 'SP' },
  { codigo: '3518800', nome: 'Guarulhos', uf: 'SP' },
  { codigo: '3547809', nome: 'Santo André', uf: 'SP' },
  { codigo: '3548708', nome: 'São Bernardo do Campo', uf: 'SP' },
  { codigo: '3548807', nome: 'São Caetano do Sul', uf: 'SP' },
  { codigo: '3534401', nome: 'Osasco', uf: 'SP' },
  { codigo: '3552205', nome: 'Sorocaba', uf: 'SP' },
  { codigo: '3543402', nome: 'Ribeirão Preto', uf: 'SP' },
] as const;

/**
 * Busca município por código IBGE
 */
export function buscarMunicipioPorCodigo(codigo: string) {
  return MUNICIPIOS_SP.find(m => m.codigo === codigo);
}

/**
 * Busca município por nome (busca parcial)
 */
export function buscarMunicipiosPorNome(nome: string) {
  const nomeLower = nome.toLowerCase();
  return MUNICIPIOS_SP.filter(m => m.nome.toLowerCase().includes(nomeLower));
}

/**
 * Valida código IBGE de município (7 dígitos)
 */
export function validarCodigoIBGE(codigo: string): boolean {
  const cleaned = codigo.replace(/\D/g, '');
  return cleaned.length === 7;
}

/**
 * Templates de URL para APIs de NFS-e de prefeituras conhecidas
 */
export const TEMPLATES_API_NFSE = [
  { 
    prefeitura: 'São Roque - Padrão Nacional', 
    urlBase: 'https://webapp1-saoroque.cidade360.cloud/Nfse.Api/NotaNacional',
    swagger: 'https://webapp1-saoroque.cidade360.cloud/Nfse.Api/swagger',
  },
  { 
    prefeitura: 'GINFES (Padrão)', 
    urlBase: 'https://{cidade}.ginfes.cloud/ServiceGinfesImpl?wsdl',
    swagger: null,
  },
] as const;

/**
 * Calcula dígito verificador da chave de acesso NFS-e (módulo 11)
 */
export function calcularDVChaveAcesso(chave43: string): string {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let pesoIndex = 0;
  
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i]) * pesos[pesoIndex];
    pesoIndex = (pesoIndex + 1) % pesos.length;
  }
  
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  
  return dv.toString();
}

/**
 * Gera chave de acesso completa (44 dígitos) para NFS-e
 */
export function gerarChaveAcessoNFSe(params: {
  codigoUF: string;       // 2 dígitos
  anoMes: string;         // AAMM (4 dígitos)
  cnpjEmitente: string;   // 14 dígitos
  modelo: string;         // 2 dígitos (55 = NF-e, 65 = NFC-e, 99 = NFS-e)
  serie: string;          // 3 dígitos
  numero: string;         // 9 dígitos
  tipoEmissao: string;    // 1 dígito
  codigoNumerico: string; // 8 dígitos
}): string {
  const { codigoUF, anoMes, cnpjEmitente, modelo, serie, numero, tipoEmissao, codigoNumerico } = params;
  
  // Remove caracteres não numéricos
  const cnpjLimpo = cnpjEmitente.replace(/\D/g, '').padStart(14, '0');
  const serieLimpa = serie.padStart(3, '0');
  const numeroLimpo = numero.padStart(9, '0');
  const codNumLimpo = codigoNumerico.padStart(8, '0');
  
  const chave43 = `${codigoUF}${anoMes}${cnpjLimpo}${modelo}${serieLimpa}${numeroLimpo}${tipoEmissao}${codNumLimpo}`;
  const dv = calcularDVChaveAcesso(chave43);
  
  return chave43 + dv;
}
