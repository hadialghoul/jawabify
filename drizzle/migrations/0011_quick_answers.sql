CREATE TABLE public.quick_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer_type text NOT NULL DEFAULT 'text' CHECK (answer_type IN ('text','voice')),
  answer_text text,
  audio_url text,
  audio_mime text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quick_answers_tenant_idx ON public.quick_answers(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_answers TO authenticated;
GRANT ALL ON public.quick_answers TO service_role;
ALTER TABLE public.quick_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members manage quick answers" ON public.quick_answers
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin())
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin());