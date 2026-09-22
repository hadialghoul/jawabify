ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_phone_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_tenant_phone_number_key
ON public.contacts (tenant_id, phone_number)
WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_unassigned_phone_number_key
ON public.contacts (phone_number)
WHERE tenant_id IS NULL;