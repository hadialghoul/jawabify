CREATE OR REPLACE FUNCTION public.get_campaign_real_counts(p_campaign_ids uuid[])
RETURNS TABLE(campaign_id uuid, total int, sent int, delivered int, read int, replied int, failed int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.campaign_id,
    count(*)::int,
    count(*) FILTER (WHERE r.status IN ('sent','delivered','read') OR r.sent_at IS NOT NULL)::int,
    count(*) FILTER (WHERE r.status IN ('delivered','read') OR r.delivered_at IS NOT NULL OR r.read_at IS NOT NULL)::int,
    count(*) FILTER (WHERE r.status = 'read' OR r.read_at IS NOT NULL)::int,
    count(*) FILTER (WHERE r.replied_at IS NOT NULL)::int,
    count(*) FILTER (WHERE r.status = 'failed')::int
  FROM public.campaign_recipients r
  JOIN public.campaigns c ON c.id = r.campaign_id
  WHERE r.campaign_id = ANY(p_campaign_ids)
    AND (public.is_super_admin() OR c.tenant_id = public.get_user_tenant_id(auth.uid()))
  GROUP BY r.campaign_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_campaign_real_counts(uuid[]) TO authenticated;