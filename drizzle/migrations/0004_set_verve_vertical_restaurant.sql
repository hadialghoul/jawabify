ALTER TABLE public.tenants DISABLE TRIGGER USER;
UPDATE public.tenants SET vertical = 'restaurant' WHERE id = '5d01aeb3-72b5-4903-b068-8939a977db21';
ALTER TABLE public.tenants ENABLE TRIGGER USER;