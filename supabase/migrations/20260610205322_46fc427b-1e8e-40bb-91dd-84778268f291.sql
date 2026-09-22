
ALTER TABLE public.wellness_packages
  ADD COLUMN IF NOT EXISTS service_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

UPDATE public.wellness_packages
   SET service_ids = ARRAY[service_id]
 WHERE service_id IS NOT NULL
   AND (service_ids IS NULL OR array_length(service_ids,1) IS NULL);
