
-- Remove overly broad webhook SELECT policies on contacts, orders, messages, app_settings, ai_knowledge, knowledge_images, tenant_credentials
-- Service role key used by webhooks bypasses RLS, so these policies are unnecessary and create exposure risk

DROP POLICY IF EXISTS "Webhooks can read contacts" ON public.contacts;
DROP POLICY IF EXISTS "Webhooks can read orders" ON public.orders;
DROP POLICY IF EXISTS "Webhooks can read messages" ON public.messages;
DROP POLICY IF EXISTS "Webhooks can read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Webhooks can read ai_knowledge" ON public.ai_knowledge;
DROP POLICY IF EXISTS "Webhooks can read knowledge_images" ON public.knowledge_images;
DROP POLICY IF EXISTS "Webhooks can read active credentials" ON public.tenant_credentials;

-- Also remove overly broad webhook INSERT/UPDATE policies that don't scope to a specific tenant
DROP POLICY IF EXISTS "Webhooks can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Webhooks can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Webhooks can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Webhooks can insert orders" ON public.orders;
