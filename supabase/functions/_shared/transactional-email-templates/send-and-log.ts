import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail, type SendTemplateEmailOptions } from './send-email.ts'

// Sends a registered template and records the outcome in email_send_log
// (sent / suppressed / failed). A log write never decides the send result.
export async function sendAndLog(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<{ sent: boolean; reason?: string }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const log = async (status: string, error_message?: string) => {
    const { error } = await supabase.from('email_send_log').insert({
      message_id: null,
      template_name: templateName,
      recipient_email: to,
      status,
      error_message: error_message ?? null,
    })
    if (error) console.error('email_send_log write failed', { code: error.code, message: error.message })
  }
  try {
    const result = await sendTemplateEmail(templateName, to, options)
    if (result.sent) {
      await log('sent')
      return { sent: true }
    }
    await log('suppressed')
    return { sent: false, reason: result.reason }
  } catch (e) {
    await log('failed', e instanceof Error ? e.message : String(e))
    throw e
  }
}
