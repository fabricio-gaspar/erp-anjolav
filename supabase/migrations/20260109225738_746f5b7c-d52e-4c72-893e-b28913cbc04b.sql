-- Create table for employees (funcionarios)
CREATE TABLE public.funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  departamento TEXT,
  telefone TEXT,
  cpf TEXT,
  email TEXT,
  login TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

-- Create policies for funcionarios
CREATE POLICY "Allow read access to funcionarios" 
ON public.funcionarios 
FOR SELECT 
USING (true);

CREATE POLICY "Allow insert on funcionarios" 
ON public.funcionarios 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update on funcionarios" 
ON public.funcionarios 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete on funcionarios" 
ON public.funcionarios 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_funcionarios_updated_at
BEFORE UPDATE ON public.funcionarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_funcionarios_login ON public.funcionarios(login);
CREATE INDEX idx_funcionarios_user_id ON public.funcionarios(user_id);