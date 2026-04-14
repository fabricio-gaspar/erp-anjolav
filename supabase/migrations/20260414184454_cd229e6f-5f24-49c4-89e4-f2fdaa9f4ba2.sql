
-- Create eventos_agenda table
CREATE TABLE public.eventos_agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_evento DATE NOT NULL,
  horario TIME WITHOUT TIME ZONE,
  tipo TEXT NOT NULL DEFAULT 'lembrete',
  cor TEXT DEFAULT '#3b82f6',
  concluido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.eventos_agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select eventos_agenda" ON public.eventos_agenda FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert eventos_agenda" ON public.eventos_agenda FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update eventos_agenda" ON public.eventos_agenda FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete eventos_agenda" ON public.eventos_agenda FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_eventos_agenda_updated_at
BEFORE UPDATE ON public.eventos_agenda
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add new columns to funcionarios
ALTER TABLE public.funcionarios ADD COLUMN data_admissao DATE;
ALTER TABLE public.funcionarios ADD COLUMN carga_horaria INTEGER DEFAULT 44;
ALTER TABLE public.funcionarios ADD COLUMN dias_trabalhados TEXT[] DEFAULT '{seg,ter,qua,qui,sex}'::TEXT[];
