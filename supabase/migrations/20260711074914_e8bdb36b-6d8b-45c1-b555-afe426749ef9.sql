ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_vertical_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_vertical_check
  CHECK (vertical IN ('ecommerce','restaurant','real_estate','wellness','healthcare','education','service'));