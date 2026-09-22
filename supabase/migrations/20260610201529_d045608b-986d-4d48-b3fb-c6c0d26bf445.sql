
CREATE OR REPLACE FUNCTION public.listing_close_leads_on_sold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('sold','rented')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.leads l
       SET status = 'closed_won',
           notes = COALESCE(l.notes,'') ||
             CASE WHEN COALESCE(l.notes,'') = '' THEN '' ELSE E'\n' END ||
             '[auto] Listing "' || COALESCE(NEW.title,'(untitled)') || '" marked ' || NEW.status || ' on ' || to_char(now(),'YYYY-MM-DD'),
           updated_at = now()
     WHERE l.tenant_id = NEW.tenant_id
       AND l.status NOT IN ('closed_won','closed_lost')
       AND l.contact_id IN (
         SELECT v.contact_id FROM public.viewings v
          WHERE v.listing_id = NEW.id AND v.contact_id IS NOT NULL
       );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listing_close_leads ON public.listings;
CREATE TRIGGER trg_listing_close_leads
AFTER UPDATE OF status ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.listing_close_leads_on_sold();
