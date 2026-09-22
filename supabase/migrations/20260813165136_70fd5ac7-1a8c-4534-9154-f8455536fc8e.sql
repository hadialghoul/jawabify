CREATE INDEX IF NOT EXISTS idx_contacts_tenant_created ON public.contacts (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_tenant_analytics(p_tenant_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT (public.is_super_admin() OR p_tenant_id = public.get_user_tenant_id(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized for tenant %', p_tenant_id;
  END IF;

  WITH msgs AS (
    SELECT m.contact_id, m.direction, m.created_at
    FROM public.messages m
    JOIN public.contacts c ON c.id = m.contact_id
    WHERE c.tenant_id = p_tenant_id
      AND m.created_at >= p_from AND m.created_at <= p_to
  ),
  ords AS (
    SELECT o.contact_id, o.product_name, o.quantity, o.status, o.delivery_fee, o.created_at
    FROM public.orders o
    WHERE o.tenant_id = p_tenant_id
      AND o.created_at >= p_from AND o.created_at <= p_to
  ),
  contact_totals AS (
    SELECT count(*)::int AS contacts,
           count(*) FILTER (WHERE is_interested)::int AS interested
    FROM public.contacts WHERE tenant_id = p_tenant_id
  ),
  msg_daily AS (
    SELECT date_trunc('day', created_at) AS d,
           count(*) FILTER (WHERE direction = 'incoming')::int AS incoming,
           count(*) FILTER (WHERE direction = 'outgoing')::int AS outgoing
    FROM msgs GROUP BY 1
  ),
  ord_daily AS (
    SELECT date_trunc('day', created_at) AS d, count(*)::int AS orders
    FROM ords GROUP BY 1
  ),
  daily AS (
    SELECT COALESCE(m.d, o.d) AS d,
           COALESCE(m.incoming, 0) AS incoming,
           COALESCE(m.outgoing, 0) AS outgoing,
           COALESCE(o.orders, 0) AS orders
    FROM msg_daily m FULL OUTER JOIN ord_daily o ON m.d = o.d
  ),
  by_status AS (
    SELECT status AS name, count(*)::int AS value FROM ords GROUP BY 1
  ),
  top_products AS (
    SELECT product_name AS name, count(*)::int AS orders, COALESCE(sum(quantity), 0)::int AS quantity
    FROM ords GROUP BY 1 ORDER BY 2 DESC LIMIT 7
  ),
  contact_msgs AS (
    SELECT contact_id, count(*)::int AS cnt FROM msgs GROUP BY 1 ORDER BY 2 DESC LIMIT 8
  ),
  top_customers AS (
    SELECT COALESCE(NULLIF(c.name, ''), c.phone_number, 'Unknown') AS name,
           COALESCE(c.phone_number, '') AS phone,
           cm.cnt AS messages
    FROM contact_msgs cm LEFT JOIN public.contacts c ON c.id = cm.contact_id
    ORDER BY cm.cnt DESC
  ),
  hourly AS (
    SELECT h.hour, COALESCE(x.cnt, 0)::int AS count
    FROM generate_series(0, 23) AS h(hour)
    LEFT JOIN (
      SELECT EXTRACT(hour FROM created_at)::int AS hour, count(*)::int AS cnt
      FROM msgs WHERE direction = 'incoming' GROUP BY 1
    ) x ON x.hour = h.hour
    ORDER BY h.hour
  ),
  first_orders AS (
    SELECT contact_id, min(created_at) AS first_at FROM ords WHERE contact_id IS NOT NULL GROUP BY 1
  ),
  ret_cust AS (
    SELECT count(*)::int AS returning_customers
    FROM first_orders f
    WHERE EXISTS (
      SELECT 1 FROM msgs m
      WHERE m.contact_id = f.contact_id AND m.direction = 'incoming' AND m.created_at > f.first_at
    )
  )
  SELECT jsonb_build_object(
    'contacts', (SELECT contacts FROM contact_totals),
    'interested', (SELECT interested FROM contact_totals),
    'messages', (SELECT count(*)::int FROM msgs),
    'incoming', (SELECT count(*) FILTER (WHERE direction = 'incoming')::int FROM msgs),
    'outgoing', (SELECT count(*) FILTER (WHERE direction = 'outgoing')::int FROM msgs),
    'orders', (SELECT count(*)::int FROM ords),
    'pendingOrders', (SELECT count(*) FILTER (WHERE status = 'pending')::int FROM ords),
    'processingOrders', (SELECT count(*) FILTER (WHERE status = 'processing')::int FROM ords),
    'completedOrders', (SELECT count(*) FILTER (WHERE status = 'completed')::int FROM ords),
    'cancelledOrders', (SELECT count(*) FILTER (WHERE status = 'cancelled')::int FROM ords),
    'revenue', (SELECT COALESCE(sum(COALESCE(delivery_fee, 0)), 0) FROM ords WHERE status = 'completed'),
    'customersWithOrders', (SELECT count(*)::int FROM first_orders),
    'returningCustomers', (SELECT returning_customers FROM ret_cust),
    'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'incoming', incoming, 'outgoing', outgoing, 'orders', orders) ORDER BY d) FROM daily), '[]'::jsonb),
    'ordersByStatus', COALESCE((SELECT jsonb_agg(to_jsonb(by_status)) FROM by_status), '[]'::jsonb),
    'topProducts', COALESCE((SELECT jsonb_agg(to_jsonb(top_products)) FROM top_products), '[]'::jsonb),
    'topCustomers', COALESCE((SELECT jsonb_agg(to_jsonb(top_customers)) FROM top_customers), '[]'::jsonb),
    'hourlyHeatmap', COALESCE((SELECT jsonb_agg(to_jsonb(hourly)) FROM hourly), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_today_stats(p_tenant_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT (public.is_super_admin() OR p_tenant_id = public.get_user_tenant_id(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized for tenant %', p_tenant_id;
  END IF;

  WITH msgs AS (
    SELECT m.contact_id, m.direction
    FROM public.messages m
    JOIN public.contacts c ON c.id = m.contact_id
    WHERE c.tenant_id = p_tenant_id
      AND m.created_at >= p_from AND m.created_at <= p_to
  ),
  ords AS (
    SELECT status FROM public.orders
    WHERE tenant_id = p_tenant_id AND created_at >= p_from AND created_at <= p_to
  )
  SELECT jsonb_build_object(
    'contactsTalked', (SELECT count(DISTINCT contact_id)::int FROM msgs WHERE direction = 'incoming'),
    'incoming', (SELECT count(*) FILTER (WHERE direction = 'incoming')::int FROM msgs),
    'outgoing', (SELECT count(*) FILTER (WHERE direction = 'outgoing')::int FROM msgs),
    'newContacts', (SELECT count(*)::int FROM public.contacts WHERE tenant_id = p_tenant_id AND created_at >= p_from AND created_at <= p_to),
    'flagged', (SELECT count(*)::int FROM public.contacts WHERE tenant_id = p_tenant_id AND needs_human AND human_requested_at >= p_from AND human_requested_at <= p_to),
    'orders', (SELECT count(*)::int FROM ords),
    'pendingOrders', (SELECT count(*) FILTER (WHERE status = 'pending')::int FROM ords),
    'processingOrders', (SELECT count(*) FILTER (WHERE status = 'processing')::int FROM ords),
    'completedOrders', (SELECT count(*) FILTER (WHERE status = 'completed')::int FROM ords),
    'cancelledOrders', (SELECT count(*) FILTER (WHERE status = 'cancelled')::int FROM ords)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_analytics(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_tenant_today_stats(uuid, timestamptz, timestamptz) TO authenticated, service_role;