CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'manual';
ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS shopify_product_id text;

CREATE UNIQUE INDEX IF NOT EXISTS ai_knowledge_tenant_shopify_uniq
  ON public.ai_knowledge(tenant_id, shopify_product_id)
  WHERE shopify_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_knowledge_embedding_idx
  ON public.ai_knowledge USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION public.match_knowledge(
  p_tenant_id uuid,
  query_embedding vector(1536),
  match_count int DEFAULT 15
)
RETURNS TABLE (id uuid, title text, content text, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.id, k.title, k.content,
         1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.ai_knowledge k
  WHERE k.tenant_id = p_tenant_id
    AND k.is_active = true
    AND k.embedding IS NOT NULL
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
$$;