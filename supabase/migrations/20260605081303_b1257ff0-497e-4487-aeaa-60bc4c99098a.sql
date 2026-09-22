CREATE OR REPLACE FUNCTION public.bump_contact_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.contacts
     SET updated_at = NEW.created_at
   WHERE id = NEW.contact_id
     AND (updated_at IS NULL OR updated_at < NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_contact_updated_at ON public.messages;
CREATE TRIGGER trg_bump_contact_updated_at
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_contact_updated_at();

UPDATE public.contacts c
   SET updated_at = sub.last_msg_at
  FROM (
    SELECT contact_id, MAX(created_at) AS last_msg_at
      FROM public.messages
     GROUP BY contact_id
  ) sub
 WHERE sub.contact_id = c.id
   AND (c.updated_at IS NULL OR c.updated_at < sub.last_msg_at);