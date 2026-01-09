import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ROLConfig {
  id: string;
  nome_curto: string;
  slogan: string | null;
  nome_completo: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  telefone: string | null;
  email: string | null;
  cnpj: string | null;
  endereco: string | null;
  exibir_logo: boolean | null;
  logo_url: string | null;
  largura_papel: string | null;
  tipo_impressora: string | null;
  margem_superior: number | null;
  margem_lateral: number | null;
  fonte_principal: string | null;
  tamanho_nome: number | null;
  tamanho_item: number | null;
  tamanho_total: number | null;
  previsao_entrega: boolean | null;
  bloco: boolean | null;
  observacoes: boolean | null;
  assinatura_cliente: boolean | null;
  tipo_preco: boolean | null;
  linha_desconto: boolean | null;
  texto_rodape: string | null;
  created_at: string;
  updated_at: string;
}

export interface ROLConfigUpdate {
  nome_curto?: string;
  slogan?: string;
  nome_completo?: string;
  cor_primaria?: string;
  cor_secundaria?: string;
  telefone?: string;
  email?: string;
  cnpj?: string;
  endereco?: string;
  exibir_logo?: boolean;
  logo_url?: string;
  largura_papel?: string;
  tipo_impressora?: string;
  margem_superior?: number;
  margem_lateral?: number;
  fonte_principal?: string;
  tamanho_nome?: number;
  tamanho_item?: number;
  tamanho_total?: number;
  previsao_entrega?: boolean;
  bloco?: boolean;
  observacoes?: boolean;
  assinatura_cliente?: boolean;
  tipo_preco?: boolean;
  linha_desconto?: boolean;
  texto_rodape?: string;
}

export const useROLConfig = () => {
  return useQuery({
    queryKey: ["rol-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rol_configuracoes")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return data as ROLConfig;
    },
  });
};

export const useUpdateROLConfig = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ROLConfigUpdate }) => {
      const { data, error } = await supabase
        .from("rol_configuracoes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rol-config"] });
      toast({
        title: "Sucesso",
        description: "Configurações de ROL salvas com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações. Tente novamente.",
        variant: "destructive",
      });
    },
  });
};

export const useUploadLogo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rol-config"] });
      toast({
        title: "Sucesso",
        description: "Logo enviada com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Erro ao enviar logo:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar logo. Tente novamente.",
        variant: "destructive",
      });
    },
  });
};
