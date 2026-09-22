CREATE OR REPLACE FUNCTION public.tenant_subscription_active(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = p_tenant_id
      AND tm.user_id = auth.uid()
      AND tm.is_active
  )
  AND EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id IN (
        SELECT t.owner_user_id FROM public.tenants t WHERE t.id = p_tenant_id
        UNION
        SELECT tm2.user_id FROM public.tenant_members tm2
        WHERE tm2.tenant_id = p_tenant_id AND tm2.role IN ('owner','admin')
      )
      AND (
        (s.status IN ('active','trialing','past_due')
          AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.tenant_subscription_active(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.tenant_subscription_active(uuid) TO authenticated;