select cron.schedule(
  'shopify-auto-sync-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url:='https://qemxlbjwpxyljkansqsl.supabase.co/functions/v1/shopify-auto-sync',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlbXhsYmp3cHh5bGprYW5zcXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTgwNzEsImV4cCI6MjA4MTUzNDA3MX0.YZ7bs6m2UvzM8WDx_ui2kPWHmValHIXLI6ProoSWOmA"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);