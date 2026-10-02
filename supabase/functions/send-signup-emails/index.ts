import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendAndLog } from '../_shared/transactional-email-templates/send-and-log.ts'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const INTERNAL_RECIPIENTS = ['Info@theleadsbridge.com', 'jawabify@gmail.com']

// Sends the signup welcome to a just-created account plus internal alerts.
// The recipient comes from the auth user record, created in the last 15 min.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const body = await req.json().catch(() => ({}))
    const userId = String(body.userId ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Invalid user' }, 400)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await supabase.auth.admin.getUserById(userId)
    if (error || !data?.user?.email) return json({ error: 'User not found' }, 404)
    const user = data.user
    if (Date.now() - new Date(user.created_at).getTime() > 15 * 60 * 1000) {
      return json({ error: 'Too late' }, 400)
    }

    const s = (v: unknown, n = 120) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
    const firstName = s(body.firstName)
    const businessName = s(body.businessName)

    const results: Record<string, unknown> = {}
    results.welcome = await sendAndLog('signup-welcome', user.email!, {
      templateData: { firstName, businessName },
      idempotencyKey: `signup-welcome-${user.id}`,
    }).catch((e) => ({ sent: false, error: String(e) }))

    for (const notifyEmail of INTERNAL_RECIPIENTS) {
      results[notifyEmail] = await sendAndLog('internal-signup-alert', notifyEmail, {
        templateData: {
          email: user.email,
          firstName,
          businessName,
          businessType: s(body.businessType),
          signedUpAt: user.created_at,
          referralSource: s(body.referralSource, 200),
        },
        idempotencyKey: `internal-signup-alert-${notifyEmail}-${user.id}`,
      }).catch((e) => ({ sent: false, error: String(e) }))
    }
    return json(results)
  } catch (e) {
    console.error('send-signup-emails failed', e instanceof Error ? e.message : e)
    return json({ error: 'Failed to send' }, 500)
  }
})
