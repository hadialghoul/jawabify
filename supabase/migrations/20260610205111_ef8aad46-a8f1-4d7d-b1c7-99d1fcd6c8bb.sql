
-- Drop old check constraint
ALTER TABLE public.wellness_leads DROP CONSTRAINT IF EXISTS wellness_leads_status_check;

-- Migrate existing data
UPDATE public.wellness_leads SET status = 'completed' WHERE status = 'closed_won';
UPDATE public.wellness_leads SET status = 'no_show' WHERE status = 'closed_lost';

-- New constraint
ALTER TABLE public.wellness_leads
  ADD CONSTRAINT wellness_leads_status_check
  CHECK (status = ANY (ARRAY['new'::text,'qualified'::text,'booked'::text,'completed'::text,'no_show'::text]));

-- Update trigger function to use new label
CREATE OR REPLACE FUNCTION public.wellness_session_close_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.lead_id IS NOT NULL THEN
    UPDATE public.wellness_leads
       SET status = 'completed',
           notes = COALESCE(notes,'') || E'\nSession completed ' || to_char(now(),'YYYY-MM-DD')
     WHERE id = NEW.lead_id
       AND status NOT IN ('completed','no_show');
  ELSIF NEW.status = 'no_show' AND (OLD.status IS DISTINCT FROM 'no_show') AND NEW.lead_id IS NOT NULL THEN
    UPDATE public.wellness_leads
       SET status = 'no_show',
           notes = COALESCE(notes,'') || E'\nSession no-show ' || to_char(now(),'YYYY-MM-DD')
     WHERE id = NEW.lead_id
       AND status NOT IN ('completed','no_show');
  END IF;
  RETURN NEW;
END;
$function$;
