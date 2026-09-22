
CREATE OR REPLACE FUNCTION public.claim_campaign_recipients(
  p_campaign_id uuid,
  p_limit integer,
  p_worker text
)
RETURNS SETOF public.campaign_recipients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.campaign_recipients cr
     SET locked_at = now(),
         locked_by = p_worker
   WHERE cr.id IN (
     SELECT id FROM public.campaign_recipients
      WHERE campaign_id = p_campaign_id
        AND status = 'pending'
        AND next_attempt_at <= now()
        AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
      ORDER BY next_attempt_at
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
   )
   RETURNING cr.*;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_campaign_recipients(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_recipients(uuid, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_stale_campaign_locks(p_max_minutes integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.campaign_recipients
       SET locked_at = NULL, locked_by = NULL
     WHERE status = 'pending'
       AND locked_at IS NOT NULL
       AND locked_at < now() - make_interval(mins => p_max_minutes)
     RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_stale_campaign_locks(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_stale_campaign_locks(integer) TO service_role;
