
ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS delivered_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS read_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replied_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_wamid
  ON public.campaign_recipients(whatsapp_message_id);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_contact_sent
  ON public.campaign_recipients(contact_id, sent_at DESC);
