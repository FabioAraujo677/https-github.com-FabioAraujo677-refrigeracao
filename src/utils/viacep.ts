import { cleanNumeric } from './formatters';

export interface ViaCepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean;
}

export async function fetchAddressByCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cleanNumeric(cep);
  if (digits.length !== 8) {
    return null;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!response.ok) {
      throw new Error('Falha ao consultar CEP');
    }
    const data = await response.json();
    if (data.erro) {
      return null;
    }
    return data as ViaCepResult;
  } catch (err) {
    console.error('Erro na consulta ViaCEP:', err);
    return null;
  }
}
