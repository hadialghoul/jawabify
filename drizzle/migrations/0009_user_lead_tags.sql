CREATE TABLE public.user_lead_tags (
  user_id uuid PRIMARY KEY,
  lead_status text NOT NULL DEFAULT 'new',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lead_tags TO authenticated;
GRANT ALL ON public.user_lead_tags TO service_role;
ALTER TABLE public.user_lead_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage user lead tags" ON public.user_lead_tags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));