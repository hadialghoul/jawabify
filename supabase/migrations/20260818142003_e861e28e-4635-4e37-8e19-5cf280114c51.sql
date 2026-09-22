CREATE TABLE IF NOT EXISTS public.whatsapp_unrouted_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  phone_number_id text,
  display_phone_number text,
  from_number text,
  preview text
);
GRANT SELECT ON public.whatsapp_unrouted_events TO authenticated;
GRANT ALL ON public.whatsapp_unrouted_events TO service_role;
ALTER TABLE public.whatsapp_unrouted_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view unrouted events"
  ON public.whatsapp_unrouted_events FOR SELECT TO authenticated
  USING (public.is_super_admin());