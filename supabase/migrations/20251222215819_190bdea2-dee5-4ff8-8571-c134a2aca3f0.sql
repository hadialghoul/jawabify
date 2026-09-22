-- Add composite index for efficient retrieval of recent messages per contact
CREATE INDEX IF NOT EXISTS idx_messages_contact_created 
ON public.messages (contact_id, created_at DESC);

-- Drop the old single-column indexes if they exist (the composite index covers these use cases)
DROP INDEX IF EXISTS idx_messages_contact_id;
DROP INDEX IF EXISTS idx_messages_created_at;