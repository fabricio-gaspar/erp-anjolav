// Serviço centralizado de APIs externas para cadastro de clientes

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  email: string | null;
  ddd_telefone_1: string | null;
  ddd_telefone_2: string | null;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  situacao_cadastral: string;
  descricao_situacao_cadastral: string;
  porte: string;
  natureza_juridica: string;
  opcao_pelo_simples: boolean | null;
  opcao_pelo_mei: boolean | null;
}

export interface BrasilApiCepResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
}

export interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName?: string;
}

// Limpar caracteres não numéricos
const limparNumeros = (valor: string): string => valor.replace(/\D/g, "");

// ViaCEP - Busca de endereço por CEP
export const buscarCep = async (cep: string): Promise<ViaCepResponse | null> => {
  const cepLimpo = limparNumeros(cep);
  if (cepLimpo.length !== 8) {
    throw new Error("CEP deve conter 8 dígitos");
  }

  const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar CEP no ViaCEP");
  }

  const data: ViaCepResponse = await response.json();
  
  if (data.erro) {
    return null;
  }

  return data;
};

// BrasilAPI - Fallback para busca de CEP
export const buscarCepBrasilApi = async (cep: string): Promise<ViaCepResponse | null> => {
  const cepLimpo = limparNumeros(cep);
  if (cepLimpo.length !== 8) {
    throw new Error("CEP deve conter 8 dígitos");
  }

  const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error("Erro ao buscar CEP na BrasilAPI");
  }

  const data: BrasilApiCepResponse = await response.json();

  // Converter para formato ViaCep
  return {
    cep: data.cep,
    logradouro: data.street || "",
    complemento: "",
    bairro: data.neighborhood || "",
    localidade: data.city || "",
    uf: data.state || "",
  };
};

// Busca de CEP com fallback
export const buscarCepComFallback = async (cep: string): Promise<ViaCepResponse | null> => {
  try {
    const resultado = await buscarCep(cep);
    if (resultado) return resultado;
  } catch (error) {
    console.log("ViaCEP falhou, tentando BrasilAPI...", error);
  }

  // Fallback para BrasilAPI
  return buscarCepBrasilApi(cep);
};

// BrasilAPI - Consulta de CNPJ
export const buscarCnpj = async (cnpj: string): Promise<BrasilApiCnpjResponse | null> => {
  const cnpjLimpo = limparNumeros(cnpj);
  if (cnpjLimpo.length !== 14) {
    throw new Error("CNPJ deve conter 14 dígitos");
  }

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error("Erro ao buscar CNPJ na BrasilAPI");
  }

  return response.json();
};

// OpenStreetMap Nominatim - Geocoding (endereço para coordenadas)
export const geocodeEndereco = async (endereco: string): Promise<GeocodingResult | null> => {
  if (!endereco.trim()) {
    return null;
  }

  const params = new URLSearchParams({
    q: endereco,
    format: "json",
    limit: "1",
    countrycodes: "br",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": "AnjoLav-ERP/1.0",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error("Erro ao geocodificar endereço");
  }

  const data: NominatimResponse[] = await response.json();

  if (data.length === 0) {
    return null;
  }

  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
};

// OpenStreetMap Nominatim - Reverse Geocoding (coordenadas para endereço)
export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: "json",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: {
      "User-Agent": "AnjoLav-ERP/1.0",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error("Erro ao realizar geocodificação reversa");
  }

  const data = await response.json();

  return data.display_name || null;
};

// Montar endereço completo para geocoding
export const montarEnderecoCompleto = (dados: {
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}): string => {
  const partes = [
    dados.logradouro,
    dados.numero,
    dados.bairro,
    dados.cidade,
    dados.uf,
    dados.cep,
    "Brasil",
  ].filter(Boolean);

  return partes.join(", ");
};

// Formatar CNPJ para exibição
export const formatarCnpj = (cnpj: string): string => {
  const numeros = limparNumeros(cnpj);
  if (numeros.length !== 14) return cnpj;
  return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

// Formatar CPF para exibição
export const formatarCpf = (cpf: string): string => {
  const numeros = limparNumeros(cpf);
  if (numeros.length !== 11) return cpf;
  return numeros.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
};

// Formatar CEP para exibição
export const formatarCep = (cep: string): string => {
  const numeros = limparNumeros(cep);
  if (numeros.length !== 8) return cep;
  return numeros.replace(/^(\d{5})(\d{3})$/, "$1-$2");
};

// Formatar telefone para exibição
export const formatarTelefone = (telefone: string): string => {
  const numeros = limparNumeros(telefone);
  if (numeros.length === 11) {
    return numeros.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }
  if (numeros.length === 10) {
    return numeros.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return telefone;
};

// Calcular distância entre dois pontos usando a fórmula Haversine
export const calcularDistanciaKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
