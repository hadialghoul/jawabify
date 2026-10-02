ALTER TABLE public.contacts
ADD COLUMN lead_status text NOT NULL DEFAULT 'new';

ALTER TABLE public.contacts
ADD CONSTRAINT contacts_lead_status_valid
CHECK (lead_status IN ('new', 'interested', 'follow_up', 'not_interested'));

COMMENT ON COLUMN public.contacts.lead_status IS 'Super Admin inbox lead status; not part of tenant CRM tags.';