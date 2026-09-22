-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create ai_knowledge table for storing AI instructions and knowledge
CREATE TABLE public.ai_knowledge (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ai_knowledge ENABLE ROW LEVEL SECURITY;

-- Create policy for full access (since this is an admin feature)
CREATE POLICY "Allow all access to ai_knowledge" 
ON public.ai_knowledge 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_knowledge_updated_at
BEFORE UPDATE ON public.ai_knowledge
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for ai_knowledge table
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_knowledge;