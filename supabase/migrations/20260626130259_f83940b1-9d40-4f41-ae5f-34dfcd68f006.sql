
-- Move messages from the misrouted "test" tenant contact into the Admin Business contact for +96171543056
UPDATE public.messages
   SET contact_id = '55d8aa56-009a-4754-a2d1-e608ea8f8ba1'
 WHERE contact_id = '0537d817-1c94-4a23-9692-84e3065ae816';

-- Bump updated_at so the chat sorts to the top
UPDATE public.contacts
   SET updated_at = now()
 WHERE id = '55d8aa56-009a-4754-a2d1-e608ea8f8ba1';

-- Remove the orphaned duplicate contact in the wrong tenant
DELETE FROM public.contacts WHERE id = '0537d817-1c94-4a23-9692-84e3065ae816';
