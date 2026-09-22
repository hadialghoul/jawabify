
create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  token      text not null unique,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid references public.tenants(id) on delete cascade,
  platform   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

alter table public.push_tokens enable row level security;

create policy "own tokens - select" on public.push_tokens
  for select to authenticated using (auth.uid() = user_id);
create policy "own tokens - insert" on public.push_tokens
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own tokens - update" on public.push_tokens
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tokens - delete" on public.push_tokens
  for delete to authenticated using (auth.uid() = user_id);

create trigger push_tokens_set_updated_at
  before update on public.push_tokens
  for each row execute function public.update_updated_at_column();

create index if not exists push_tokens_tenant_idx on public.push_tokens(tenant_id);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

-- Trigger fan-out to send-push edge function via pg_net
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_send_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text := 'https://qemxlbjwpxyljkansqsl.supabase.co/functions/v1/send-push';
  v_key text;
  v_payload jsonb;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_key is null then
    v_key := current_setting('app.service_role_key', true);
  end if;

  v_payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end,
    'old_record', case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end
  );

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_key, '')
    ),
    body := v_payload
  );
  return null;
end;
$$;

drop trigger if exists send_push_on_message_insert on public.messages;
create trigger send_push_on_message_insert
  after insert on public.messages
  for each row execute function public.notify_send_push();

drop trigger if exists send_push_on_contact_update on public.contacts;
create trigger send_push_on_contact_update
  after update on public.contacts
  for each row execute function public.notify_send_push();
