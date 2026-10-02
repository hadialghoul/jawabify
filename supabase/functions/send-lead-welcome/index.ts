import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendAndLog } from '../_shared/transactional-email-templates/send-and-log.ts'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Public: sends the lead-welcome email only to an address that just submitted
// a consultation lead (last 10 minutes), using the stored name.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().slice(0, 255)
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Invalid email' }, 400)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: lead, error } = await supabase
      .from('consultation_leads')
      .select('id, full_name')
      .ilike('email', email)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!lead) return json({ error: 'No recent submission' }, 404)

    const result = await sendAndLog('lead-welcome', email, {
      templateData: { fullName: lead.full_name },
      idempotencyKey: `lead-welcome-${lead.id}`,
    })
    return json(result)
  } catch (e) {
    console.error('send-lead-welcome failed', e instanceof Error ? e.message : e)
    return json({ error: 'Failed to send' }, 500)
  }
})
