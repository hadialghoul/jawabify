CREATE TABLE public.app_user_oauth_nonces (
  nonce text PRIMARY KEY,
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes'
);

GRANT ALL ON public.app_user_oauth_nonces TO service_role;

ALTER TABLE public.app_user_oauth_nonces ENABLE ROW LEVEL SECURITY;