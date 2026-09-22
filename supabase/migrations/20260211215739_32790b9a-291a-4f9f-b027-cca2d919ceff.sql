
-- Fix: Change RESTRICTIVE policies to PERMISSIVE on tenants table
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Members can view their tenant" ON public.tenants;
CREATE POLICY "Members can view their tenant"
ON public.tenants FOR SELECT TO authenticated
USING (id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Owner can update their tenant" ON public.tenants;
CREATE POLICY "Owner can update their tenant"
ON public.tenants FOR UPDATE TO authenticated
USING (owner_user_id = auth.uid());

-- Fix tenant_members INSERT policy too
DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.tenant_members;
CREATE POLICY "Users can insert themselves as members"
ON public.tenant_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can view their tenant members" ON public.tenant_members;
CREATE POLICY "Members can view their tenant members"
ON public.tenant_members FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Fix tenant_credentials policies
DROP POLICY IF EXISTS "Members can view their tenant credentials" ON public.tenant_credentials;
CREATE POLICY "Members can view their tenant credentials"
ON public.tenant_credentials FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Members can insert tenant credentials" ON public.tenant_credentials;
CREATE POLICY "Members can insert tenant credentials"
ON public.tenant_credentials FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Members can update tenant credentials" ON public.tenant_credentials;
CREATE POLICY "Members can update tenant credentials"
ON public.tenant_credentials FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Members can delete tenant credentials" ON public.tenant_credentials;
CREATE POLICY "Members can delete tenant credentials"
ON public.tenant_credentials FOR DELETE TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));
