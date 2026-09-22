-- Server-only helpers and trigger functions: no client should call these.
revoke execute on function public.contacts_apply_tenant_ai_default() from anon, authenticated;
revoke execute on function public.create_tenant_wallet() from anon, authenticated;
revoke execute on function public.education_enrollment_close_lead() from anon, authenticated;
revoke execute on function public.healthcare_appt_close_lead() from anon, authenticated;
revoke execute on function public.listing_close_leads_on_sold() from anon, authenticated;
revoke execute on function public.wellness_session_close_lead() from anon, authenticated;
revoke execute on function public.guard_education_only() from anon, authenticated;
revoke execute on function public.guard_healthcare_only() from anon, authenticated;
revoke execute on function public.guard_real_estate_only() from anon, authenticated;
revoke execute on function public.guard_restaurant_only() from anon, authenticated;
revoke execute on function public.guard_wellness_only() from anon, authenticated;
revoke execute on function public.prevent_vertical_change() from anon, authenticated;
revoke execute on function public.notify_send_push() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.email_queue_wake() from anon, authenticated;
revoke execute on function public.email_queue_dispatch() from anon, authenticated;
revoke execute on function public.enqueue_email(text, jsonb) from anon, authenticated;
revoke execute on function public.delete_email(text, bigint) from anon, authenticated;
revoke execute on function public.read_email_batch(text, integer, integer) from anon, authenticated;
revoke execute on function public.move_to_dlq(text, text, bigint, jsonb) from anon, authenticated;
revoke execute on function public.close_stale_member_sessions(integer) from anon, authenticated;
revoke execute on function public.assert_tenant_vertical(uuid, text) from anon, authenticated;
revoke execute on function public.match_knowledge(uuid, vector, integer) from anon, authenticated;

-- Dashboard helpers: signed-in users only, never the public.
revoke execute on function public.get_contact_previews(uuid[]) from anon;
revoke execute on function public.get_member_activity(uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.get_tenant_analytics(uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.get_tenant_today_stats(uuid, timestamptz, timestamptz) from anon;
revoke execute on function public.tenant_subscription_active(uuid) from anon;
revoke execute on function public.get_tenant_vertical(uuid) from anon;
revoke execute on function public.get_user_tenant_id(uuid) from anon;
revoke execute on function public.tenant_member_role(uuid) from anon;
revoke execute on function public.is_tenant_admin(uuid) from anon;
revoke execute on function public.is_super_admin() from anon;
revoke execute on function public.has_active_subscription(uuid, text) from anon;
revoke execute on function public.has_role(uuid, public.app_role) from anon;