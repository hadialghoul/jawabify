DROP POLICY IF EXISTS "Members can view their teammates" ON public.tenant_members;
CREATE POLICY "Members can view their teammates"
ON public.tenant_members FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin());