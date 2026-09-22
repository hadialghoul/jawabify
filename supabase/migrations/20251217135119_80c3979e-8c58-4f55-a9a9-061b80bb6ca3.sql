-- Create app_settings table for storing application settings
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS but allow public access (no auth in this app)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write settings (no auth)
CREATE POLICY "Allow public read access" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.app_settings FOR UPDATE USING (true);

-- Insert default setting for AI replies
INSERT INTO public.app_settings (key, value) VALUES ('ai_replies_enabled', 'true');

-- Trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();