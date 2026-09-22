CREATE OR REPLACE FUNCTION public.auto_assign_contact_on_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'outgoing' AND NEW.sent_by_member_id IS NOT NULL THEN
    UPDATE public.contacts
       SET assigned_member_id = NEW.sent_by_member_id,
           assigned_at = now(),
           assigned_by_member_id = NEW.sent_by_member_id
     WHERE id = NEW.contact_id
       AND (assigned_member_id IS NULL OR assigned_member_id <> NEW.sent_by_member_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_contact_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  IF NEW.assigned_member_id IS NOT DISTINCT FROM OLD.assigned_member_id THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_super_admin() OR public.is_tenant_admin(NEW.tenant_id) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_member_id
    FROM public.tenant_members
   WHERE tenant_id = NEW.tenant_id AND user_id = auth.uid()
   LIMIT 1;

  -- Members may take a chat for themselves (even from a teammate), or release their own.
  IF NEW.assigned_member_id = v_member_id THEN
    RETURN NEW;
  END IF;
  IF OLD.assigned_member_id = v_member_id AND NEW.assigned_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only an account admin can assign this chat to someone else';
END;
$$;