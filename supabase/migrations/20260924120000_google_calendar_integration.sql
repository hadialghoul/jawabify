-- Google Calendar integration: encrypted refresh token storage + OAuth state table.

ALTER TABLE public.tenant_credentials
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted text,
  ADD COLUMN IF NOT EXISTS google_email text;

CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  state TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes'
);
GRANT ALL ON public.google_oauth_states TO service_role;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
