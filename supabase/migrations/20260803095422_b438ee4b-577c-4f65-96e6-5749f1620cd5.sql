CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::app_role);
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'ai_knowledge','app_settings','knowledge_images','campaigns','campaign_recipients',
    'bills','bill_items','menu_categories','menu_items','restaurant_tables','reservations',
    'education_courses','education_enrollments','education_leads','education_settings',
    'healthcare_appointments','healthcare_doctors','healthcare_lab_results','healthcare_leads',
    'healthcare_settings','healthcare_specialties','push_tokens','email_send_log',
    'contacts','messages','orders','order_sessions','tenants','tenant_credentials',
    'tenant_wallets','wallet_transactions','profiles','subscriptions','tenant_members'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Super admins full access ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())',
      'Super admins full access ' || t, t
    );
  END LOOP;
END $$;