-- Remove duplicate empty "Super Admin Inbox" tenants created by a repeated
-- auto-provision bug, keeping the one that holds the WhatsApp credentials/chats.
DO $$
DECLARE
  v_keep uuid := 'df94f879-12b4-457c-8f2b-fb96ca7576b9';
  v_dupe uuid;
BEGIN
  FOR v_dupe IN
    SELECT t.id FROM public.tenants t
    WHERE t.name = 'Super Admin Inbox'
      AND t.id <> v_keep
      AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.tenant_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM public.tenant_credentials tc WHERE tc.tenant_id = t.id)
  LOOP
    DELETE FROM public.tenant_members WHERE tenant_id = v_dupe;
    DELETE FROM public.tenants WHERE id = v_dupe;
  END LOOP;
END $$;

-- Guard against it happening again: one membership row per user.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_user_unique
  ON public.tenant_members (user_id);
