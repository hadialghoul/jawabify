-- 1. Assignment columns
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS assigned_member_id uuid REFERENCES public.tenant_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by_member_id uuid REFERENCES public.tenant_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contacts_assigned_member_idx
  ON public.contacts (tenant_id, assigned_member_id);

-- 2. Auto-claim: first human outgoing reply assigns the chat to that member
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
       AND assigned_member_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_auto_assign_contact ON public.messages;
CREATE TRIGGER messages_auto_assign_contact
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_contact_on_reply();

-- 3. Guard who may change an assignment
CREATE OR REPLACE FUNCTION public.guard_contact_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  -- No assignment change, or no authenticated end-user (service role / webhooks): allow.
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

  -- Employees may claim an unassigned chat for themselves, or release their own.
  IF OLD.assigned_member_id IS NULL AND NEW.assigned_member_id = v_member_id THEN
    RETURN NEW;
  END IF;
  IF OLD.assigned_member_id = v_member_id AND NEW.assigned_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only an account admin can change this chat assignment';
END;
$$;

DROP TRIGGER IF EXISTS contacts_guard_assignment ON public.contacts;
CREATE TRIGGER contacts_guard_assignment
BEFORE UPDATE OF assigned_member_id ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.guard_contact_assignment();

-- 4. Per-member assigned chat counts for the team screen
CREATE OR REPLACE FUNCTION public.get_assignment_counts(p_tenant_id uuid)
RETURNS TABLE(member_id uuid, assigned_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.assigned_member_id, count(*)::int
    FROM public.contacts c
   WHERE c.tenant_id = p_tenant_id
     AND c.assigned_member_id IS NOT NULL
     AND (public.is_super_admin() OR p_tenant_id = public.get_user_tenant_id(auth.uid()))
   GROUP BY c.assigned_member_id
$$;

GRANT EXECUTE ON FUNCTION public.get_assignment_counts(uuid) TO authenticated;