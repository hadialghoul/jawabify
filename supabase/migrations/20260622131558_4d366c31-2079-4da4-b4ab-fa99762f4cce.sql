
-- Campaign worker queue: add scheduling, throttling, retry, locking
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_rate_per_minute integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS concurrency integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS paused_reason text,
  ADD COLUMN IF NOT EXISTS auto_paused boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_pending
  ON public.campaign_recipients (campaign_id, next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_campaigns_active
  ON public.campaigns (status, scheduled_at)
  WHERE status IN ('sending','scheduled');

-- Cron extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
