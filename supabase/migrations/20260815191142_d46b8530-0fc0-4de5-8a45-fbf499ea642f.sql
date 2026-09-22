CREATE TABLE public.push_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  tenant_id UUID,
  user_id UUID,
  title TEXT,
  body TEXT,
  outcome TEXT NOT NULL,
  http_status INTEGER,
  error TEXT
);
CREATE INDEX idx_push_attempts_created_at ON public.push_attempts (created_at DESC);
GRANT ALL ON public.push_attempts TO service_role;
GRANT SELECT ON public.push_attempts TO authenticated;
ALTER TABLE public.push_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view push attempts" ON public.push_attempts FOR SELECT TO authenticated USING (public.is_super_admin());