CREATE INDEX IF NOT EXISTS idx_ai_knowledge_tenant_type_title ON public.ai_knowledge (tenant_id, type, title);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_tenant_title ON public.ai_knowledge (tenant_id, title);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_type ON public.ai_knowledge (type);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_tenant_updated ON public.ai_knowledge (tenant_id, updated_at DESC);
ANALYZE public.ai_knowledge;