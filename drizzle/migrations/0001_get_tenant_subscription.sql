-- Lets any member of a workspace read the workspace subscription (owned by the
-- account owner), so employees can see plan status in Settings too.
create or replace function public.get_tenant_subscription(p_tenant_id uuid)
returns setof public.subscriptions
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.subscriptions s
  where s.user_id in (select user_id from public.tenant_members where tenant_id = p_tenant_id)
    and (
      exists (select 1 from public.tenant_members m where m.tenant_id = p_tenant_id and m.user_id = auth.uid())
      or public.is_super_admin()
    )
  order by s.created_at desc
$$;

grant execute on function public.get_tenant_subscription(uuid) to authenticated;