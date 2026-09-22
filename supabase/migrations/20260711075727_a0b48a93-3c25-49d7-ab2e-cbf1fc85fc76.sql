
CREATE TABLE public.consultation_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  source_path text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.consultation_leads TO anon, authenticated;
GRANT SELECT ON public.consultation_leads TO authenticated;
GRANT ALL ON public.consultation_leads TO service_role;

ALTER TABLE public.consultation_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a consultation lead"
  ON public.consultation_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(full_name) BETWEEN 1 AND 120
    AND length(email) BETWEEN 3 AND 255
    AND length(phone) BETWEEN 3 AND 40
  );

CREATE POLICY "Super admins can view consultation leads"
  ON public.consultation_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX consultation_leads_created_at_idx ON public.consultation_leads (created_at DESC);
