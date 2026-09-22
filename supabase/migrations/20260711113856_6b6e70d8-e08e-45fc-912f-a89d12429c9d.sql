DO $$
DECLARE
  admin_tenant uuid;
  source_contact uuid;
  target_contact uuid;
BEGIN
  SELECT tc.tenant_id INTO admin_tenant
  FROM public.tenant_credentials tc
  JOIN public.tenants t ON t.id = tc.tenant_id
  WHERE tc.provider = 'whatsapp_cloud'
    AND tc.is_active = true
    AND tc.phone_number_id = '1245095855349985'
  LIMIT 1;

  IF admin_tenant IS NULL THEN
    SELECT id INTO admin_tenant
    FROM public.tenants
    WHERE name = 'Super Admin Inbox'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF admin_tenant IS NULL THEN
    RAISE NOTICE 'No Super Admin Inbox tenant found; skipping data move.';
    RETURN;
  END IF;

  SELECT id INTO target_contact
  FROM public.contacts
  WHERE tenant_id = admin_tenant
    AND phone_number IN ('+96171543056', '96171543056')
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF target_contact IS NULL THEN
    INSERT INTO public.contacts (tenant_id, phone_number, name, ai_enabled)
    VALUES (admin_tenant, '+96171543056', 'abed', false)
    RETURNING id INTO target_contact;
  ELSE
    UPDATE public.contacts
    SET ai_enabled = false,
        name = COALESCE(NULLIF(name, ''), 'abed'),
        updated_at = now()
    WHERE id = target_contact;
  END IF;

  SELECT c.id INTO source_contact
  FROM public.contacts c
  JOIN public.tenants t ON t.id = c.tenant_id
  WHERE c.tenant_id <> admin_tenant
    AND c.phone_number IN ('+96171543056', '96171543056')
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.contact_id = c.id
        AND m.created_at >= '2026-07-11 11:32:00+00'::timestamptz
    )
  ORDER BY c.updated_at DESC NULLS LAST
  LIMIT 1;

  IF source_contact IS NOT NULL THEN
    UPDATE public.messages
    SET contact_id = target_contact
    WHERE contact_id = source_contact
      AND created_at >= '2026-07-11 11:32:00+00'::timestamptz;

    UPDATE public.contacts
    SET updated_at = now()
    WHERE id = target_contact;
  END IF;
END $$;