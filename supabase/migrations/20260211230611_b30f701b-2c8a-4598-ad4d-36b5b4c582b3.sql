
-- Fix: Convert all restrictive policies to permissive for tenants and tenant_members

-- TENANTS
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;
DROP POLICY IF EXISTS "Members can view their tenant" ON public.tenants;
DROP POLICY IF EXISTS "Owner can update their tenant" ON public.tenants;

CREATE POLICY "Authenticated users can create tenants" ON public.tenants FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Members can view their tenant" ON public.tenants FOR SELECT TO authenticated USING (id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Owner can update their tenant" ON public.tenants FOR UPDATE TO authenticated USING (owner_user_id = auth.uid());

-- TENANT_MEMBERS
DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.tenant_members;
DROP POLICY IF EXISTS "Members can view their tenant members" ON public.tenant_members;

CREATE POLICY "Users can insert themselves as members" ON public.tenant_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members can view their tenant members" ON public.tenant_members FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- TENANT_CREDENTIALS
DROP POLICY IF EXISTS "Members can view their tenant credentials" ON public.tenant_credentials;
DROP POLICY IF EXISTS "Members can insert tenant credentials" ON public.tenant_credentials;
DROP POLICY IF EXISTS "Members can update tenant credentials" ON public.tenant_credentials;
DROP POLICY IF EXISTS "Members can delete tenant credentials" ON public.tenant_credentials;

CREATE POLICY "Members can view their tenant credentials" ON public.tenant_credentials FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Members can insert tenant credentials" ON public.tenant_credentials FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Members can update tenant credentials" ON public.tenant_credentials FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Members can delete tenant credentials" ON public.tenant_credentials FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- CONTACTS
DROP POLICY IF EXISTS "Tenant members can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Tenant members can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Tenant members can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Tenant members can delete contacts" ON public.contacts;

CREATE POLICY "Tenant members can view contacts" ON public.contacts FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- MESSAGES
DROP POLICY IF EXISTS "Tenant members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Tenant members can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Tenant members can update messages" ON public.messages;
DROP POLICY IF EXISTS "Tenant members can delete messages" ON public.messages;

CREATE POLICY "Tenant members can view messages" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM contacts c WHERE c.id = messages.contact_id AND c.tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Tenant members can insert messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM contacts c WHERE c.id = messages.contact_id AND c.tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Tenant members can update messages" ON public.messages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM contacts c WHERE c.id = messages.contact_id AND c.tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Tenant members can delete messages" ON public.messages FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM contacts c WHERE c.id = messages.contact_id AND c.tenant_id = get_user_tenant_id(auth.uid())));

-- ORDERS
DROP POLICY IF EXISTS "Tenant members can view orders" ON public.orders;
DROP POLICY IF EXISTS "Tenant members can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Tenant members can update orders" ON public.orders;
DROP POLICY IF EXISTS "Tenant members can delete orders" ON public.orders;

CREATE POLICY "Tenant members can view orders" ON public.orders FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can update orders" ON public.orders FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can delete orders" ON public.orders FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- APP_SETTINGS
DROP POLICY IF EXISTS "Tenant members can view app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Tenant members can insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Tenant members can update app_settings" ON public.app_settings;

CREATE POLICY "Tenant members can view app_settings" ON public.app_settings FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can insert app_settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can update app_settings" ON public.app_settings FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- AI_KNOWLEDGE
DROP POLICY IF EXISTS "Tenant members can view ai_knowledge" ON public.ai_knowledge;
DROP POLICY IF EXISTS "Tenant members can insert ai_knowledge" ON public.ai_knowledge;
DROP POLICY IF EXISTS "Tenant members can update ai_knowledge" ON public.ai_knowledge;
DROP POLICY IF EXISTS "Tenant members can delete ai_knowledge" ON public.ai_knowledge;

CREATE POLICY "Tenant members can view ai_knowledge" ON public.ai_knowledge FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can insert ai_knowledge" ON public.ai_knowledge FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can update ai_knowledge" ON public.ai_knowledge FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can delete ai_knowledge" ON public.ai_knowledge FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- KNOWLEDGE_IMAGES
DROP POLICY IF EXISTS "Tenant members can view knowledge_images" ON public.knowledge_images;
DROP POLICY IF EXISTS "Tenant members can insert knowledge_images" ON public.knowledge_images;
DROP POLICY IF EXISTS "Tenant members can update knowledge_images" ON public.knowledge_images;
DROP POLICY IF EXISTS "Tenant members can delete knowledge_images" ON public.knowledge_images;

CREATE POLICY "Tenant members can view knowledge_images" ON public.knowledge_images FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can insert knowledge_images" ON public.knowledge_images FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can update knowledge_images" ON public.knowledge_images FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members can delete knowledge_images" ON public.knowledge_images FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
