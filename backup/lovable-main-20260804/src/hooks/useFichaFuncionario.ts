import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EnderecoFuncionario {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

export interface FichaFuncionarioData {
  id: string;
  // Pessoal
  nome?: string;
  cpf?: string | null;
  data_nascimento?: string | null;
  genero?: string | null;
  estado_civil?: string | null;
  nacionalidade?: string | null;
  naturalidade?: string | null;
  nome_mae?: string | null;
  nome_pai?: string | null;
  escolaridade?: string | null;
  telefone?: string | null;
  email?: string | null;
  // Documentos
  rg?: string | null;
  rg_orgao_emissor?: string | null;
  pis?: string | null;
  ctps_numero?: string | null;
  ctps_serie?: string | null;
  ctps_uf?: string | null;
  titulo_eleitor?: string | null;
  cnh_numero?: string | null;
  cnh_categoria?: string | null;
  cnh_validade?: string | null;
  // Endereço
  endereco?: EnderecoFuncionario;
  // Emergência
  contato_emergencia_nome?: string | null;
  contato_emergencia_telefone?: string | null;
  contato_emergencia_parentesco?: string | null;
  // Contrato
  cargo?: string;
  departamento?: string | null;
  data_admissao?: string | null;
  data_demissao?: string | null;
  tipo_contrato?: string | null;
  regime_jornada?: string | null;
  carga_horaria?: number | null;
  dias_trabalhados?: string[] | null;
  // Remuneração
  salario_base?: number;
  valor_hora?: number | null;
  vale_transporte?: number;
  vale_alimentacao?: number;
  vale_refeicao?: number;
  plano_saude?: number;
  plano_odontologico?: number;
  comissao_percentual?: number;
  gratificacao?: number;
  periculosidade?: boolean;
  insalubridade_percentual?: number;
  desconto_inss_percentual?: number | null;
  desconto_vt_percentual?: number;
  outros_descontos?: number;
  outros_beneficios?: number;
  // Banco
  banco_nome?: string | null;
  banco_agencia?: string | null;
  banco_conta?: string | null;
  banco_tipo_conta?: string | null;
  pix_chave?: string | null;
  pix_tipo_chave?: string | null;
  // Empregador
  empregador_cnpj?: string | null;
  empregador_nome?: string | null;
  codigo_externo?: string | null;
  cbo?: string | null;
  matricula_inss?: string | null;
  centro_custo?: string | null;
  filial?: string | null;
  // Geral
  observacoes?: string | null;
  ativo?: boolean;
}

export const useUpdateFichaFuncionario = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: FichaFuncionarioData) => {
      const { id, ...rest } = data;
      const { data: f, error } = await supabase
        .from("funcionarios")
        .update(rest as any)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!f) throw new Error("Sem permissão para editar a ficha (necessário perfil ADMINISTRADOR).");
      return f;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      toast.success("Ficha atualizada com sucesso!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar ficha"),
  });
};

export function calcularCustoMensal(f: Partial<FichaFuncionarioData>): number {
  const proventos =
    Number(f.salario_base || 0) +
    Number(f.gratificacao || 0) +
    Number(f.vale_transporte || 0) +
    Number(f.vale_alimentacao || 0) +
    Number(f.vale_refeicao || 0) +
    Number(f.plano_saude || 0) +
    Number(f.plano_odontologico || 0) +
    Number(f.outros_beneficios || 0);
  // Encargos estimados: ~36% sobre salário base (FGTS+INSS patronal+provisões)
  const encargos = Number(f.salario_base || 0) * 0.36;
  return proventos + encargos;
}
