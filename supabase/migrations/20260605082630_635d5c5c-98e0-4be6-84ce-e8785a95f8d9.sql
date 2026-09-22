
CREATE OR REPLACE FUNCTION public.get_contact_previews(p_contact_ids uuid[])
RETURNS TABLE (
  contact_id uuid,
  last_content text,
  last_created_at timestamptz,
  unread_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (m.contact_id)
      m.contact_id, m.content, m.created_at
    FROM public.messages m
    WHERE m.contact_id = ANY(p_contact_ids)
      AND EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = m.contact_id
          AND (
            c.tenant_id = public.get_user_tenant_id(auth.uid())
            OR public.has_role(auth.uid(), 'super_admin'::app_role)
          )
      )
    ORDER BY m.contact_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.contact_id, count(*)::int AS cnt
    FROM public.messages m
    WHERE m.contact_id = ANY(p_contact_ids)
      AND m.direction = 'incoming'
      AND m.status = 'delivered'
    GROUP BY m.contact_id
  )
  SELECT
    l.contact_id,
    l.content,
    l.created_at,
    COALESCE(u.cnt, 0)
  FROM latest l
  LEFT JOIN unread u ON u.contact_id = l.contact_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_contact_previews(uuid[]) TO authenticated;
