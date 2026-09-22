CREATE INDEX IF NOT EXISTS idx_messages_contact_created ON public.messages (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_contact_dir_status ON public.messages (contact_id, direction, status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON public.orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_updated ON public.contacts (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON public.contacts (created_at DESC);