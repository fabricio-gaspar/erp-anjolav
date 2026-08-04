import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CertificadoInfo {
  nome: string;
  validade: string | null;
  url: string;
  cnpj: string | null;
  tamanho: number;
}

export interface CertificadoUploadResult {
  success: boolean;
  certificadoUrl: string;
  validade: string | null;
  cnpj: string | null;
  error?: string;
}

/**
 * Extrai informações básicas do certificado .pfx/.p12
 * Nota: Validação completa do certificado requer uma Edge Function
 * Esta é uma validação básica do arquivo
 */
async function validarArquivoCertificado(file: File): Promise<{ valid: boolean; error?: string }> {
  // Verificar extensão
  const nomeArquivo = file.name.toLowerCase();
  if (!nomeArquivo.endsWith('.pfx') && !nomeArquivo.endsWith('.p12')) {
    return { valid: false, error: "Arquivo deve ter extensão .pfx ou .p12" };
  }

  // Verificar tamanho (máximo 5MB para certificados)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { valid: false, error: "Arquivo muito grande. Máximo permitido: 5MB" };
  }

  // Verificar se é um arquivo válido (não vazio)
  if (file.size < 100) {
    return { valid: false, error: "Arquivo parece estar corrompido ou vazio" };
  }

  return { valid: true };
}

/**
 * Gera um nome único para o arquivo no storage
 */
function gerarNomeArquivo(cnpj: string, nomeOriginal: string): string {
  const timestamp = Date.now();
  const extensao = nomeOriginal.split('.').pop()?.toLowerCase() || 'pfx';
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  return `certificados/${cnpjLimpo}/${timestamp}.${extensao}`;
}

export function useCertificadoUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [certificadoInfo, setCertificadoInfo] = useState<CertificadoInfo | null>(null);
  const queryClient = useQueryClient();

  const uploadCertificado = useMutation({
    mutationFn: async ({
      file,
      senha,
      cnpj,
      configId,
    }: {
      file: File;
      senha: string;
      cnpj: string;
      configId: string;
    }): Promise<CertificadoUploadResult> => {
      setIsUploading(true);
      setUploadProgress(10);

      // Validar arquivo
      const validacao = await validarArquivoCertificado(file);
      if (!validacao.valid) {
        throw new Error(validacao.error);
      }

      setUploadProgress(20);

      // Verificar se a senha foi fornecida
      if (!senha || senha.length < 1) {
        throw new Error("Senha do certificado é obrigatória");
      }

      setUploadProgress(30);

      // Gerar nome único para o arquivo
      const nomeArquivo = gerarNomeArquivo(cnpj, file.name);

      // Upload para o Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("certificates")
        .upload(nomeArquivo, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      setUploadProgress(60);

      // Obter URL do arquivo (não é pública, mas podemos referenciar)
      const certificadoUrl = uploadData.path;

      // Calcular validade estimada (1 ano a partir de hoje - isso é uma estimativa)
      // Em produção, você usaria uma Edge Function para extrair a validade real do certificado
      const validadeEstimada = new Date();
      validadeEstimada.setFullYear(validadeEstimada.getFullYear() + 1);
      const validadeString = validadeEstimada.toISOString().split('T')[0];

      setUploadProgress(80);

      // Atualizar configuração fiscal com os dados do certificado
      const { error: updateError } = await supabase
        .from("configuracoes_fiscais")
        .update({
          certificado_url: certificadoUrl,
          validade_certificado: validadeString,
          // A senha seria criptografada em produção via Edge Function
          senha_certificado_encrypted: senha ? "***encrypted***" : null,
        })
        .eq("id", configId);

      if (updateError) {
        // Se falhou ao atualizar, tentar remover o arquivo
        await supabase.storage.from("certificates").remove([nomeArquivo]);
        throw new Error(`Erro ao salvar configuração: ${updateError.message}`);
      }

      setUploadProgress(100);

      // Salvar info do certificado
      setCertificadoInfo({
        nome: file.name,
        validade: validadeString,
        url: certificadoUrl,
        cnpj: cnpj,
        tamanho: file.size,
      });

      return {
        success: true,
        certificadoUrl,
        validade: validadeString,
        cnpj,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes_fiscais"] });
      toast.success("Certificado digital enviado com sucesso!", {
        description: `Validade estimada: ${result.validade}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar certificado", {
        description: error.message,
      });
    },
    onSettled: () => {
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  const removerCertificado = useMutation({
    mutationFn: async ({
      configId,
      certificadoUrl,
    }: {
      configId: string;
      certificadoUrl: string;
    }) => {
      // Remover do storage
      const { error: storageError } = await supabase.storage
        .from("certificates")
        .remove([certificadoUrl]);

      if (storageError) {
        console.warn("Aviso: Erro ao remover arquivo do storage:", storageError);
      }

      // Limpar referência no banco
      const { error: updateError } = await supabase
        .from("configuracoes_fiscais")
        .update({
          certificado_url: null,
          validade_certificado: null,
          senha_certificado_encrypted: null,
        })
        .eq("id", configId);

      if (updateError) {
        throw new Error(`Erro ao atualizar configuração: ${updateError.message}`);
      }

      setCertificadoInfo(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes_fiscais"] });
      toast.success("Certificado removido com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover certificado", {
        description: error.message,
      });
    },
  });

  return {
    uploadCertificado,
    removerCertificado,
    isUploading,
    uploadProgress,
    certificadoInfo,
  };
}
