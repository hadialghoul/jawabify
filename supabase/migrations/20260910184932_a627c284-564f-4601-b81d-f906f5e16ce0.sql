CREATE OR REPLACE FUNCTION public.guard_wellness_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v text;
BEGIN
  SELECT vertical INTO v FROM public.tenants WHERE id = NEW.tenant_id;
  IF v IS NULL OR v NOT IN ('wellness', 'service') THEN
    RAISE EXCEPTION 'tenant_vertical_mismatch: expected wellness or service, got %', COALESCE(v, '(null)') USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;