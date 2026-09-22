
-- Create table for knowledge base images
CREATE TABLE public.knowledge_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  description TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_images ENABLE ROW LEVEL SECURITY;

-- Allow all access (no auth in this app)
CREATE POLICY "Allow all access to knowledge_images"
ON public.knowledge_images FOR ALL
USING (true)
WITH CHECK (true);
