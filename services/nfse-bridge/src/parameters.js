import { validateCnpj, validateCpf } from 'open-nfse';

const cleanCnpj = (value) => String(value ?? '').toUpperCase().replace(/[./-]/g, '');
const cleanCpf = (value) => String(value ?? '').replace(/[./-]/g, '');
const requireValue = (value, label) => {
  if (value === null || value === undefined || value === '') throw new Error(`Campo fiscal ausente: ${label}`);
  return value;
};

// O perfil tributário é configurado fora da requisição e vinculado ao CNPJ.
// Não inferir regime, classificação, retenção ou percentuais.
export function buildParameters(payload, profile, now = new Date()) {
  if (payload.environment !== 'homologacao') throw new Error('Este serviço aceita somente produção restrita');
  if (payload.tenantId !== profile.tenantId || payload.emitterId !== profile.emitterId) throw new Error('Perfil fiscal não autorizado');
  const invoice = requireValue(payload.invoice, 'fatura');
  const issuer = requireValue(invoice.issuer, 'emitente');
  const customer = requireValue(invoice.customer, 'tomador');
  const cnpj = cleanCnpj(requireValue(issuer.cnpj, 'CNPJ emitente'));
  validateCnpj(cnpj);
  if (cnpj !== cleanCnpj(profile.cnpj)) throw new Error('CNPJ não corresponde ao perfil fiscal');
  const document = cleanCnpj(requireValue(customer.cpf_cnpj, 'documento tomador'));
  const isCpf = /^\d{11}$/.test(document);
  if (isCpf) validateCpf(cleanCpf(document)); else validateCnpj(document);
  const address = requireValue(customer.endereco, 'endereço tomador');
  const municipalityKey = `${String(address.cidade || '').trim().toUpperCase()}|${String(address.uf || '').trim().toUpperCase()}`;
  // Para cadastros antigos, aceita somente a correspondência expressamente
  // cadastrada no perfil fiscal; não presume o município pelo CEP ou nome.
  const ibge = requireValue(address.codigo_municipio_ibge || profile.municipios?.[municipalityKey], 'código IBGE do município do tomador');
  if (!/^\d{7}$/.test(ibge)) throw new Error('Código IBGE do tomador inválido');
  if (invoice.operationNature !== 'tributacao_municipio') throw new Error('Natureza exige configuração e revisão fiscal específica');
  const fiscal = requireValue(profile.fiscal, 'configuração tributária');
  const expectedRegime = { 'simples-nacional': '3', 'mei': '2', 'lucro-real': '1', 'lucro-presumido': '1' }[issuer.regime_tributario];
  if (!expectedRegime || fiscal.regime?.opSimpNac !== expectedRegime) throw new Error('Regime tributário diverge do cadastro do emitente');
  if (!fiscal.valoresTributarios?.tribISSQN || !fiscal.valoresTributarios?.tpRetISSQN) throw new Error('Tributação e retenção de ISS precisam estar configuradas');
  if (!/^\d{6}$/.test(String(fiscal.codigoTributacaoNacional ?? ''))) throw new Error('Código nacional de tributação deve ter seis dígitos');
  if (String(issuer.codigo_servico || '').replace(/[.\s]/g, '') !== fiscal.codigoTributacaoNacional) throw new Error('Código nacional diverge do cadastro do emitente');
  const total = Number(invoice.total);
  if (!Number.isFinite(total) || total <= 0 || Math.abs(Math.round(total * 100) - total * 100) > 1e-7) throw new Error('Valor fiscal inválido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(invoice.periodEnd ?? ''))) throw new Error('Competência fiscal inválida');
  return {
    emitente: {
      cnpj, codMunicipio: requireValue(issuer.codigo_municipio_ibge, 'município emitente'),
      inscricaoMunicipal: requireValue(issuer.inscricao_municipal, 'inscrição municipal emitente'),
      regime: requireValue(fiscal.regime, 'regime tributário'),
    },
    serie: requireValue(profile.serie, 'série DPS'),
    nDPS: '1',
    tpAmb: '2',
    dhEmi: now,
    dCompet: new Date(`${invoice.periodEnd}T12:00:00-03:00`),
    servico: {
      cTribNac: fiscal.codigoTributacaoNacional,
      descricao: requireValue(invoice.serviceDescription, 'descrição do serviço'),
      ...(fiscal.codigoNbs ? { cNBS: fiscal.codigoNbs } : {}),
      ...(fiscal.codigoTributacaoMunicipal ? { cTribMun: fiscal.codigoTributacaoMunicipal } : {}),
      ...(fiscal.codigoMunicipioPrestacao ? { codMunicipioPrestacao: fiscal.codigoMunicipioPrestacao } : {}),
    },
    valores: { ...requireValue(fiscal.valoresTributarios, 'tributação'), vServ: total },
    tomador: {
      documento: isCpf ? { CPF: document } : { CNPJ: document },
      nome: requireValue(customer.razao_social, 'nome tomador'),
      ...(customer.email ? { email: customer.email } : {}),
      endereco: {
        codMunicipio: ibge, cep: String(requireValue(address.cep, 'CEP')).replace(/\D/g, ''),
        logradouro: requireValue(address.logradouro, 'logradouro'), numero: requireValue(address.numero, 'número'),
        bairro: requireValue(address.bairro, 'bairro'), ...(address.complemento ? { complemento: address.complemento } : {}),
      },
    },
    // O CEP já é validado pelo XSD; não enviar endereços a terceiros.
    skipCepValidation: true,
  };
}
