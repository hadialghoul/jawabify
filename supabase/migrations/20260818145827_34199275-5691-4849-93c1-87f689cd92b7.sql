UPDATE public.contacts c
SET human_requested_at = i.last_at
FROM (
  SELECT contact_id, max(created_at) AS last_at
  FROM public.ai_incidents
  WHERE incident_type IN ('handoff','low_confidence') AND contact_id IS NOT NULL
  GROUP BY contact_id
) i
WHERE c.id = i.contact_id AND c.human_requested_at IS NULL;