do $$
declare
  r record;
  server_only text[] := array[
    'contacts_apply_tenant_ai_default','create_tenant_wallet','education_enrollment_close_lead',
    'healthcare_appt_close_lead','listing_close_leads_on_sold','wellness_session_close_lead',
    'guard_education_only','guard_healthcare_only','guard_real_estate_only','guard_restaurant_only',
    'guard_wellness_only','prevent_vertical_change','notify_send_push','handle_new_user',
    'email_queue_wake','email_queue_dispatch','enqueue_email','delete_email','read_email_batch',
    'move_to_dlq','close_stale_member_sessions','assert_tenant_vertical','match_knowledge'
  ];
  signed_in_only text[] := array[
    'get_contact_previews','get_member_activity','get_tenant_analytics','get_tenant_today_stats',
    'tenant_subscription_active','get_tenant_vertical','get_user_tenant_id','tenant_member_role',
    'is_tenant_admin','is_super_admin','has_active_subscription','has_role',
    'get_assignment_counts','get_unread_contact_ids'
  ];
begin
  for r in
    select p.oid::regprocedure::text sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and (p.proname = any(server_only) or p.proname = any(signed_in_only))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role, postgres', r.sig);
    if r.proname = any(signed_in_only) then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;