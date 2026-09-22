
CREATE INDEX IF NOT EXISTS idx_wellness_sessions_reminder ON public.wellness_sessions (scheduled_at) WHERE reminder_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_healthcare_appts_reminder ON public.healthcare_appointments (scheduled_at) WHERE reminder_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_viewings_reminder ON public.viewings (scheduled_at) WHERE reminder_sent_at IS NULL;

DO $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  IF v_key IS NULL THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'appointment-reminders-hourly') THEN
    PERFORM cron.unschedule('appointment-reminders-hourly');
  END IF;

  PERFORM cron.schedule(
    'appointment-reminders-hourly',
    '0 * * * *',
    format($cron$
      SELECT net.http_post(
        url := 'https://qemxlbjwpxyljkansqsl.supabase.co/functions/v1/appointment-reminders',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := '{}'::jsonb
      );
    $cron$, v_key)
  );
END $$;
