// AI auto-reply for Instagram Direct messages.
// Text-only replies grounded in the tenant knowledge base, mirroring the
// customer's language. Respects the same off-switches as WhatsApp:
//   app_settings.ai_replies_enabled (tenant) and contacts.ai_enabled (per chat).

const GATEWAY = 'https://ai.gateway.lovable.dev/v1';
const INSTAGRAM_GRAPH_VERSION = 'v25.0';

const BASE_PROMPT = `You are an Instagram Direct assistant for this business. Keep every reply to ONE short sentence, never more than 15 words unless the customer explicitly asks for details. No greetings, no filler, no over-explaining. Emojis sparingly.

## Language: MIRROR THE CUSTOMER
Reply in the EXACT same language and script the customer last used (Arabic script → Arabic script, Lebanese Arabizi like "badde/shu/3andak" → Arabizi with 2/3/5/7 numerals, English → English). Switch immediately when the customer switches, even if previous bot turns were in another language.

## NEVER INVENT
Prices, stock, colors, sizes, shipping and policies come ONLY from the knowledge base below. Entries marked [LIVE CATALOG] are the only valid price/stock source. Never quote a number that is not written there, never invent specs, durations or performance claims, and never write "[old price removed]". If the knowledge base says nothing about the topic, say the team will confirm it (in the customer's language) — do not guess.

## ANSWER THE EXACT QUESTION
Answer the specific thing asked (price → price, stock → stock). If a customer sends a product URL, take the product name from the slug after "/products/" and answer about that product. Never ask "which product?" when the message or history already names it.`;

const LOCKS: Record<string, string> = {
  english: 'Reply ONLY in English, whatever language the customer writes in.',
  arabizi: 'Reply ONLY in Lebanese Arabizi (Latin letters with 2/3/5/7 numerals), whatever language the customer writes in.',
  arabic: 'Reply ONLY in Arabic script, whatever language the customer writes in.',
  french: 'Reply ONLY in French, whatever language the customer writes in.',
};

const CATALOG_TYPES = ['shopify_product', 'file_product', 'website_product', 'product'];

async function embedQuery(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: text.slice(0, 4000) }),
    });
    if (!res.ok) {
      console.error('IG embed failed', res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return json.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error('IG embed exception', err);
    return null;
  }
}

async function buildKnowledgeSection(
  admin: any,
  tenantId: string,
  userMessage: string,
  apiKey: string,
): Promise<string> {
  const entries: Array<{ title: string; content: string; isCatalog: boolean }> = [];
  const seen = new Set<string>();
  const push = (title: string, content: string, isCatalog: boolean) => {
    if (!title || seen.has(title)) return;
    seen.add(title);
    entries.push({ title, content: content || '', isCatalog });
  };

  // Exact-ish title match on catalog rows first — semantic search alone can miss
  // the exact product among many near-identical variants.
  const words = userMessage
    .replace(/https?:\/\/\S+/gi, (u) => u.split('/products/')[1]?.replace(/-/g, ' ') ?? ' ')
    .replace(/[^\p{L}\p{N}.]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 8)
    .map((w) => w.replace(/[%_]/g, ''))
    .filter(Boolean);
  if (words.length) {
    const { data: exact } = await admin
      .from('ai_knowledge')
      .select('title, content')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('type', CATALOG_TYPES)
      .or(words.map((w) => `title.ilike.%${w}%`).join(','))
      .limit(8);
    for (const row of exact ?? []) push(row.title, row.content, true);
  }

  const emb = await embedQuery(userMessage, apiKey);
  if (emb) {
    const { data: matches, error } = await admin.rpc('match_knowledge', {
      p_tenant_id: tenantId,
      query_embedding: emb as any,
      match_count: 15,
    });
    if (error) console.error('IG match_knowledge error', error);
    for (const m of matches ?? []) push(m.title, m.content, true);
  }

  const { data: manual } = await admin
    .from('ai_knowledge')
    .select('title, content')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .not('type', 'in', `(${CATALOG_TYPES.map((t) => `"${t}"`).join(',')})`)
    .order('created_at', { ascending: true });
  for (const row of manual ?? []) push(row.title, row.content, false);

  if (!entries.length) return '';
  entries.sort((a, b) => Number(b.isCatalog) - Number(a.isCatalog));
  const body = entries
    .map((e) => {
      const content = e.isCatalog
        ? e.content
        : e.content
            .replace(/\$\s*\d+(?:\.\d{1,2})?/g, '[old price removed]')
            .replace(/\b(?:USD|US\$)\s*\d+(?:\.\d{1,2})?/gi, '[old price removed]');
      return `## ${e.title}${e.isCatalog ? ' [LIVE CATALOG — authoritative price/stock]' : ' [GENERAL NOTES — NOT a price source]'}\n${content}`;
    })
    .join('\n\n');
  return `\n\nKnowledge base:\n\n${body}`;
}

/**
 * Generates and sends an Instagram AI reply for the given contact.
 * Returns true when a reply was sent.
 */
export async function replyToInstagramMessage(opts: {
  admin: any;
  tenantId: string;
  contactId: string;
  igsid: string;
  senderId: string;
  accessToken: string;
  userMessage: string;
}): Promise<boolean> {
  const { admin, tenantId, contactId, igsid, senderId, accessToken, userMessage } = opts;
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    console.error('IG AI: LOVABLE_API_KEY missing');
    return false;
  }

  // ===== AI off switches =====
  const { data: globalRow } = await admin
    .from('app_settings')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('key', 'ai_replies_enabled')
    .maybeSingle();
  if (globalRow && (globalRow.value === false || globalRow.value === 'false')) {
    console.log('IG AI: tenant replies disabled', tenantId);
    return false;
  }
  const { data: contactRow } = await admin
    .from('contacts')
    .select('ai_enabled')
    .eq('id', contactId)
    .maybeSingle();
  if (contactRow?.ai_enabled === false) {
    console.log('IG AI: disabled for contact', contactId);
    return false;
  }

  // ===== Context =====
  const { data: history } = await admin
    .from('messages')
    .select('content, direction, created_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(20);
  const conversation = (history ?? [])
    .slice()
    .reverse()
    .map((m: any) => ({
      role: m.direction === 'incoming' ? ('user' as const) : ('assistant' as const),
      content: String(m.content ?? ''),
    }))
    .filter((m: any) => m.content);

  const recentUserText = conversation
    .filter((m: any) => m.role === 'user')
    .slice(-4)
    .map((m: any) => m.content)
    .join('\n') || userMessage;

  let prompt = BASE_PROMPT + (await buildKnowledgeSection(admin, tenantId, recentUserText, apiKey));

  const { data: langRow } = await admin
    .from('app_settings')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('key', 'ai_reply_language')
    .maybeSingle();
  const forced = typeof langRow?.value === 'string'
    ? langRow.value.replace(/^"|"$/g, '')
    : langRow?.value ? String(langRow.value) : 'all';
  if (forced !== 'all' && LOCKS[forced]) {
    prompt += `\n\n## HARD LANGUAGE LOCK (HIGHEST PRIORITY)\n${LOCKS[forced]}`;
  }

  // ===== Generate =====
  let reply = '';
  try {
    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemini-3.8-flash',
        messages: [{ role: 'system', content: prompt }, ...conversation],
      }),
    });
    if (!res.ok) {
      // 429/5xx are transient; 400/401/402/403 are terminal. Either way this
      // request stops here — Meta must still get a 200 from the webhook.
      console.error('IG AI gateway error', res.status, await res.text());
      return false;
    }
    const json = await res.json();
    reply = String(json?.choices?.[0]?.message?.content ?? '').trim();
  } catch (err) {
    console.error('IG AI gateway exception', err);
    return false;
  }
  if (!reply) return false;

  // ===== Send =====
  const sendRes = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${senderId}/messages?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: igsid }, message: { text: reply } }),
    },
  );
  if (!sendRes.ok) {
    console.error('IG AI send failed', await sendRes.text());
    return false;
  }

  const { error: insertErr } = await admin.from('messages').insert({
    contact_id: contactId,
    content: reply,
    direction: 'outgoing',
    status: 'sent',
    platform: 'instagram',
  });
  if (insertErr) console.error('IG AI message insert failed', insertErr);
  return true;
}
