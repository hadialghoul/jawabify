
CREATE OR REPLACE FUNCTION public.listing_close_leads_on_sold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF NEW.status IN ('sold','rented')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    -- 1) Move any existing leads (linked via viewings on this listing) to closed_won.
    WITH upd AS (
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
         )
      RETURNING 1
    )
    SELECT count(*) INTO v_updated FROM upd;

    -- 2) If nothing existed, drop a placeholder lead so the sale shows on the board.
    IF v_updated = 0 THEN
      INSERT INTO public.leads (
        tenant_id, status, intent, property_type, assigned_agent_id, source, notes
      ) VALUES (
        NEW.tenant_id,
        'closed_won',
        CASE WHEN NEW.kind = 'buy' THEN 'buy' WHEN NEW.kind = 'rent' THEN 'rent' ELSE NULL END,
        NEW.property_type,
        NEW.agent_id,
        'listing_sold',
        '[auto] Listing "' || COALESCE(NEW.title,'(untitled)') || '" marked ' || NEW.status || ' on ' || to_char(now(),'YYYY-MM-DD')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
