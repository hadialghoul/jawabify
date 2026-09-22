-- Remove rows left behind by deleted accounts
DELETE FROM public.bills b WHERE NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = b.tenant_id);
DELETE FROM public.reservations r WHERE NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = r.tenant_id);
DELETE FROM public.menu_item_modifiers m WHERE NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = m.tenant_id);
DELETE FROM public.menu_items m WHERE NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = m.tenant_id);
DELETE FROM public.menu_categories c WHERE NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = c.tenant_id);
DELETE FROM public.restaurant_tables rt WHERE NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = rt.tenant_id);

-- Prevent it happening again
ALTER TABLE public.bills ADD CONSTRAINT bills_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.menu_categories ADD CONSTRAINT menu_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.menu_item_modifiers ADD CONSTRAINT menu_item_modifiers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_tables ADD CONSTRAINT restaurant_tables_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;