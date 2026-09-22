
WITH dupes AS (
  SELECT c1.id AS keep_id, c2.id AS drop_id
  FROM public.contacts c1
  JOIN public.contacts c2
    ON c1.tenant_id IS NOT DISTINCT FROM c2.tenant_id
   AND c1.phone_number = '+' || c2.phone_number
   AND c2.phone_number !~ '^\+'
),
moved AS (
  UPDATE public.messages m SET contact_id = d.keep_id
  FROM dupes d WHERE m.contact_id = d.drop_id
  RETURNING 1
),
moved_orders AS (
  UPDATE public.orders o SET contact_id = d.keep_id
  FROM dupes d WHERE o.contact_id = d.drop_id
  RETURNING 1
)
DELETE FROM public.contacts c USING dupes d WHERE c.id = d.drop_id;
