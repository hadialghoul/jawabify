---
name: AI Shopify Knowledge Import
description: Shopify products are now manually imported into per-product ai_knowledge rows with vector embeddings; AI uses semantic retrieval (top-15) instead of live Shopify fetches.
type: feature
---
- Shopify import button in Settings → Knowledge calls `shopify-import-knowledge` edge function.
- Each product becomes one `ai_knowledge` row (`type='shopify_product'`, `shopify_product_id` for idempotency) with a 1536-dim `embedding` column (model `openai/text-embedding-3-small` via Lovable AI Gateway).
- Images downloaded (5s timeout, batches of 10) → uploaded to `chat-media/knowledge/shopify/<pid>-<imgid>.<ext>` → `knowledge_images` row tagged `[shopify:<pid>:<imgid>]`. Re-import skips already-tagged images and retries missing ones.
- `whatsapp-cloud-webhook` no longer calls Shopify live for knowledge. It embeds the incoming message and calls `match_knowledge(tenant_id, embedding, 15)` to fetch the top-15 relevant rows. Manual / learned rows are still always appended.
- `app_settings.shopify_last_imported_at` stores the timestamp shown in the UI.
- "Clear Shopify import" calls `shopify-clear-knowledge` to delete the rows, images, and storage files for a clean slate.
- Order-creation Shopify Admin API calls untouched.
