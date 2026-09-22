DO $$
DECLARE
  v_user_id uuid := '2284e730-7271-485e-8345-db8357be2907';
  v_tenant_id uuid;
BEGIN
  DELETE FROM public.tenant_members
  WHERE user_id = v_user_id
    AND tenant_id = 'a0000000-0000-0000-0000-000000000001';

  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE owner_user_id = v_user_id
    AND name = 'Super Admin Inbox'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, owner_user_id, vertical, ai_replies_enabled)
    VALUES ('Super Admin Inbox', v_user_id, 'service', false)
    RETURNING id INTO v_tenant_id;
  END IF;

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id, 'owner')
  ON CONFLICT DO NOTHING;
END $$;