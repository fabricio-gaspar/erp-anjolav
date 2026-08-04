-- Create table for area access if it doesn't exist
CREATE TABLE IF NOT EXISTS public.area_permissoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    area text NOT NULL CHECK (area IN ('central', 'industrial', 'residencial')),
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, area)
);

-- Grant access
GRANT SELECT, INSERT, DELETE ON public.area_permissoes TO authenticated;
GRANT ALL ON public.area_permissoes TO service_role;

-- Enable RLS
ALTER TABLE public.area_permissoes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own area permissions"
ON public.area_permissoes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all area permissions"
ON public.area_permissoes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Security Definer function to check area access
CREATE OR REPLACE FUNCTION public.has_area_access(_user_id uuid, _area text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Admin has access to everything
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
    UNION ALL
    -- Specific area access
    SELECT 1 FROM public.area_permissoes WHERE user_id = _user_id AND area = _area
  )
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.has_area_access(uuid, text) TO authenticated;
