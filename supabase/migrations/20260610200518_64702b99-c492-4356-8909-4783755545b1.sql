-- Switch Test Restaurant tenant to real_estate vertical for testing
ALTER TABLE public.tenants DISABLE TRIGGER USER;
UPDATE public.tenants
   SET vertical = 'real_estate',
       name = 'Test Real Estate'
 WHERE id = 'e3b121f1-449e-42f6-ab3c-988963513d06';
ALTER TABLE public.tenants ENABLE TRIGGER USER;