-- Adicionar coluna avatar_url na tabela funcionarios
ALTER TABLE funcionarios
ADD COLUMN avatar_url TEXT;

-- Criar bucket para avatares (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket
CREATE POLICY "Avatars são públicos para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Qualquer usuário pode fazer upload de avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Qualquer usuário pode atualizar avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');

CREATE POLICY "Qualquer usuário pode deletar avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars');