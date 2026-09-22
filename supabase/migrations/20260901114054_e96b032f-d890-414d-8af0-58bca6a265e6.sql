create or replace function public.get_unread_contact_ids(p_tenant_id uuid, p_limit integer default 2000)
returns TABLE(contact_id uuid, unread_count integer, last_created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.contact_id, count(*)::int as unread_count, max(m.created_at) as last_created_at
  from public.messages m
  join public.contacts c on c.id = m.contact_id
  where c.tenant_id = p_tenant_id
    and m.direction = 'incoming'
    and m.status = 'delivered'
    and (
      p_tenant_id = public.get_user_tenant_id(auth.uid())
      or public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  group by m.contact_id
  order by max(m.created_at) desc
  limit greatest(p_limit, 1)
$$;

grant execute on function public.get_unread_contact_ids(uuid, integer) to authenticated;
grant execute on function public.get_unread_contact_ids(uuid, integer) to service_role;