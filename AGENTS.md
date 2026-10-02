# Architecture Decisions

- Shopify photos are never stored: send_image fetches them live, converts through Shopify to a safe JPEG, and uploads the bytes transiently to WhatsApp. Keeps database storage at zero while preventing Meta media rejections.
- Super Admin lead stages use `contacts.lead_status`; never mix these private workflow stages into tenant-visible CRM tags.- Embedded Shopify app (/shopify/app) signs stores in via App Bridge session token + token exchange (shopify-session-auth) using SHOPIFY_V2_* secrets; no password or Stripe path — required for App Store policies 1.2.1/4.5.5.
- App emails send through per-feature edge functions (send-lead-welcome, send-signup-emails) using the shared sendTemplateEmail helper on Lovable-managed delivery; never a generic browser-callable send endpoint — recipients must come from trusted records.
