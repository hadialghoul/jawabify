
-- =============================================
-- Phase 1: Profiles table
-- =============================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text,
  business_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Phase 2: Tenant tables
-- =============================================
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tenant_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  phone_number text,
  phone_number_id text,
  access_token text,
  account_sid text,
  auth_token text,
  verify_token text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_credentials ENABLE ROW LEVEL SECURITY;

-- Trigger for tenants updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_credentials_updated_at
  BEFORE UPDATE ON public.tenant_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Phase 2b: Add tenant_id to existing tables
-- =============================================
ALTER TABLE public.contacts ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_knowledge ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_images ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.app_settings ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- =============================================
-- Phase 3: Tenant lookup function for RLS
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_members
  WHERE user_id = p_user_id LIMIT 1;
$$;

-- =============================================
-- Phase 3b: RLS policies for tenant tables
-- =============================================

-- Tenants: members can view their tenant
CREATE POLICY "Members can view their tenant"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owner can update their tenant"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Authenticated users can create tenants"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- Tenant members
CREATE POLICY "Members can view their tenant members"
  ON public.tenant_members FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert themselves as members"
  ON public.tenant_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Tenant credentials
CREATE POLICY "Members can view their tenant credentials"
  ON public.tenant_credentials FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Members can insert tenant credentials"
  ON public.tenant_credentials FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Members can update tenant credentials"
  ON public.tenant_credentials FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Members can delete tenant credentials"
  ON public.tenant_credentials FOR DELETE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- =============================================
-- Phase 3c: Replace existing open RLS policies
-- =============================================

-- Contacts
DROP POLICY IF EXISTS "Allow all access to contacts" ON public.contacts;

CREATE POLICY "Tenant members can view contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can insert contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can update contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can delete contacts"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Messages (scoped via contact join)
DROP POLICY IF EXISTS "Allow all access to messages" ON public.messages;

CREATE POLICY "Tenant members can view messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
    AND c.tenant_id = public.get_user_tenant_id(auth.uid())
  ));

CREATE POLICY "Tenant members can insert messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
    AND c.tenant_id = public.get_user_tenant_id(auth.uid())
  ));

CREATE POLICY "Tenant members can update messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
    AND c.tenant_id = public.get_user_tenant_id(auth.uid())
  ));

CREATE POLICY "Tenant members can delete messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
    AND c.tenant_id = public.get_user_tenant_id(auth.uid())
  ));

-- Orders
DROP POLICY IF EXISTS "Allow all access to orders" ON public.orders;

CREATE POLICY "Tenant members can view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can insert orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- AI Knowledge
DROP POLICY IF EXISTS "Allow all access to ai_knowledge" ON public.ai_knowledge;

CREATE POLICY "Tenant members can view ai_knowledge"
  ON public.ai_knowledge FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can insert ai_knowledge"
  ON public.ai_knowledge FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can update ai_knowledge"
  ON public.ai_knowledge FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can delete ai_knowledge"
  ON public.ai_knowledge FOR DELETE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Knowledge Images
DROP POLICY IF EXISTS "Allow all access to knowledge_images" ON public.knowledge_images;

CREATE POLICY "Tenant members can view knowledge_images"
  ON public.knowledge_images FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can insert knowledge_images"
  ON public.knowledge_images FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can update knowledge_images"
  ON public.knowledge_images FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can delete knowledge_images"
  ON public.knowledge_images FOR DELETE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- App Settings
DROP POLICY IF EXISTS "Allow public read access" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public insert access" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public update access" ON public.app_settings;

CREATE POLICY "Tenant members can view app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can insert app_settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can update app_settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- =============================================
-- Webhook access: allow service role to insert contacts/messages
-- without tenant membership (webhooks use service role key)
-- =============================================

-- Allow webhooks (anon/service) to read tenant_credentials for routing
CREATE POLICY "Webhooks can read active credentials"
  ON public.tenant_credentials FOR SELECT
  TO anon
  USING (is_active = true);

-- Allow webhooks to insert contacts (anon for webhook functions)  
CREATE POLICY "Webhooks can insert contacts"
  ON public.contacts FOR INSERT
  TO anon
  WITH CHECK (tenant_id IS NOT NULL);

-- Allow webhooks to read contacts for lookup
CREATE POLICY "Webhooks can read contacts"
  ON public.contacts FOR SELECT
  TO anon
  USING (tenant_id IS NOT NULL);

-- Allow webhooks to update contacts
CREATE POLICY "Webhooks can update contacts"
  ON public.contacts FOR UPDATE
  TO anon
  USING (tenant_id IS NOT NULL);

-- Allow webhooks to insert messages
CREATE POLICY "Webhooks can insert messages"
  ON public.messages FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow webhooks to read messages for conversation history
CREATE POLICY "Webhooks can read messages"
  ON public.messages FOR SELECT
  TO anon
  USING (true);

-- Allow webhooks to read ai_knowledge
CREATE POLICY "Webhooks can read ai_knowledge"
  ON public.ai_knowledge FOR SELECT
  TO anon
  USING (is_active = true);

-- Allow webhooks to read knowledge_images
CREATE POLICY "Webhooks can read knowledge_images"
  ON public.knowledge_images FOR SELECT
  TO anon
  USING (is_active = true);

-- Allow webhooks to read app_settings
CREATE POLICY "Webhooks can read app_settings"
  ON public.app_settings FOR SELECT
  TO anon
  USING (true);

-- Allow webhooks to insert orders (AI can create orders)
CREATE POLICY "Webhooks can insert orders"
  ON public.orders FOR INSERT
  TO anon
  WITH CHECK (tenant_id IS NOT NULL);

-- Allow webhooks to read orders
CREATE POLICY "Webhooks can read orders"
  ON public.orders FOR SELECT
  TO anon
  USING (true);
