
-- Add media columns to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Create storage bucket for chat media
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read chat media (public bucket)
CREATE POLICY "Public read access for chat media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

-- Allow authenticated and anon users to upload chat media
CREATE POLICY "Allow uploads to chat media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media');
