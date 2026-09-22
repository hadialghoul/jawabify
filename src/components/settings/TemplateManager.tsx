import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2, RefreshCw, FileText, Copy, Check, Package, Send, CalendarClock, Braces, MessageSquare, Phone, Link as LinkIcon } from 'lucide-react';
import { useTenantVertical } from '@/hooks/useTenantVertical';
import { actingHeaders } from '@/lib/actingTenant';

interface WhatsAppTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
}

interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  value: string;
}

/** Highest {{n}} placeholder used in a template string. */
function countVariables(text: string): number {
  const matches = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
  return matches.length ? Math.max(...matches) : 0;
}

/**
 * WhatsApp body text allows newlines, but rejects CRLF, tabs,
 * 5+ consecutive spaces and more than 2 consecutive newlines.
 */
function normalizeBodyText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.replace(/ {4,}/g, '   ').replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Header and footer must be a single line with no newlines or tabs. */
function normalizeSingleLine(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
}


const CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'UTILITY', label: 'Utility' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
];

const LANGUAGES = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'en_GB', label: 'English (UK)' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt_BR', label: 'Portuguese (BR)' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
];

const REMINDER_TEMPLATES: Record<string, { name: string; body: string; example: string[]; label: string; secondLabel: string; description: string }> = {
  wellness: {
    name: 'appointment_reminder',
    label: 'Appointment Reminder',
    secondLabel: 'Service',
    body: "Hi {{1}}, this is a reminder for your {{2}} appointment on {{3}}. Reply CONFIRM to keep it, RESCHEDULE to change it, or CANCEL.",
    example: ['Sarah', 'Deep tissue massage', 'Tue, 3:00 PM'],
    description: 'Sent automatically 24 hours before every confirmed session. Once approved, no extra setup needed.',
  },
  healthcare: {
    name: 'appointment_reminder',
    label: 'Appointment Reminder',
    secondLabel: 'Doctor',
    body: "Hi {{1}}, this is a reminder for your appointment with Dr. {{2}} on {{3}}. Reply CONFIRM to keep it, RESCHEDULE to change it, or CANCEL.",
    example: ['Sarah', 'Khoury', 'Tue, 3:00 PM'],
    description: 'Sent automatically 24 hours before every confirmed appointment. Once approved, no extra setup needed.',
  },
  real_estate: {
    name: 'viewing_reminder',
    label: 'Viewing Reminder',
    secondLabel: 'Property',
    body: "Hi {{1}}, this is a reminder for your viewing of {{2}} on {{3}}. Reply CONFIRM to keep it, RESCHEDULE to change it, or CANCEL.",
    example: ['Sarah', '2BR Achrafieh apartment', 'Tue, 3:00 PM'],
    description: 'Sent automatically 24 hours before every confirmed viewing. Once approved, no extra setup needed.',
  },
  education: {
    name: 'class_reminder',
    label: 'Class Reminder',
    secondLabel: 'Course',
    body: "Hi {{1}}, reminder: your {{2}} class starts tomorrow at {{3}}. See you then!",
    example: ['Sarah', 'Beginner Piano', '4:00 PM'],
    description: 'Sent automatically the day before every active enrollment starts. Once approved, no extra setup needed.',
  },
};

export function TemplateManager() {
  const { vertical } = useTenantVertical();
  const reminderCfg = REMINDER_TEMPLATES[vertical];
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en_US');
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [headerExample, setHeaderExample] = useState<string[]>([]);
  const [bodyExample, setBodyExample] = useState<string[]>([]);
  const [buttons, setButtons] = useState<TemplateButton[]>([]);

  const headerVars = countVariables(headerText);
  const bodyVars = countVariables(bodyText);

  const addVariable = (target: 'header' | 'body') => {
    if (target === 'header') {
      // WhatsApp allows only one variable in a text header
      if (headerVars >= 1) {
        toast.error('Text headers support only one variable');
        return;
      }
      setHeaderText((prev) => `${prev}{{1}}`);
    } else {
      setBodyText((prev) => `${prev}{{${countVariables(prev) + 1}}}`);
    }
  };

  const addButton = (type: TemplateButton['type']) => {
    if (buttons.length >= 3) {
      toast.error('WhatsApp allows a maximum of 3 buttons');
      return;
    }
    if (type === 'URL' && buttons.some((b) => b.type === 'URL')) {
      toast.error('Only one URL button is allowed');
      return;
    }
    if (type === 'PHONE_NUMBER' && buttons.some((b) => b.type === 'PHONE_NUMBER')) {
      toast.error('Only one call button is allowed');
      return;
    }
    setButtons((prev) => [...prev, { type, text: '', value: '' }]);
  };

  const updateButton = (index: number, patch: Partial<TemplateButton>) => {
    setButtons((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const removeButton = (index: number) => {
    setButtons((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke('whatsapp-templates', { headers: actingHeaders(),
        method: 'GET',
      });

      if (res.error) throw res.error;
      const list: WhatsAppTemplate[] = res.data?.data || [];
      // Meta keeps deleted templates in the list with a DELETED status — hide them.
      setTemplates(list.filter((t) => !String(t.status || '').toUpperCase().includes('DELETED')));
    } catch (error: any) {
      console.error('Failed to fetch templates:', error);
      // Don't toast on initial load if no WABA configured
      if (!error.message?.includes('Missing access token')) {
        toast.error('Failed to load templates');
      }
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !bodyText.trim()) {
      toast.error('Name and body text are required');
      return;
    }

    // Template name must be lowercase with underscores only
    const templateName = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!templateName) {
      toast.error('Invalid template name');
      return;
    }

    setCreating(true);
    try {
      const components: any[] = [];

      if (normalizeSingleLine(headerText)) {
        const header: any = { type: 'HEADER', format: 'TEXT', text: normalizeSingleLine(headerText) };
        if (headerVars > 0) {
          const samples = Array.from({ length: headerVars }, (_, i) => normalizeSingleLine(headerExample[i] || '') || `sample${i + 1}`);
          header.example = { header_text: samples };
        }
        components.push(header);
      }

      const body: any = { type: 'BODY', text: normalizeBodyText(bodyText) };
      if (bodyVars > 0) {
        const samples = Array.from({ length: bodyVars }, (_, i) => normalizeSingleLine(bodyExample[i] || '') || `sample${i + 1}`);
        body.example = { body_text: [samples] };
      }
      components.push(body);

      if (normalizeSingleLine(footerText)) {
        components.push({ type: 'FOOTER', text: normalizeSingleLine(footerText) });
      }


      if (buttons.length > 0) {
        const invalid = buttons.find(
          (b) => !b.text.trim() || (b.type !== 'QUICK_REPLY' && !b.value.trim())
        );
        if (invalid) {
          toast.error('Fill in every button label and its link/phone number');
          setCreating(false);
          return;
        }
        components.push({
          type: 'BUTTONS',
          buttons: buttons.map((b) => {
            const label = normalizeSingleLine(b.text);
            if (b.type === 'URL') return { type: 'URL', text: label, url: b.value.trim() };
            if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: label, phone_number: b.value.trim() };
            return { type: 'QUICK_REPLY', text: label };
          }),

        });
      }


      // Use direct fetch so we can read Meta's error body even on non-2xx
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: templateName, category, language, components }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) {
        const msg =
          data?.error?.error_user_msg ||
          data?.error?.message ||
          (typeof data?.error === 'string' ? data.error : null) ||
          `Failed (${resp.status})`;
        console.error('Template create failed:', data);
        toast.error(msg);
      } else {
        toast.success('Template submitted for review');
        setShowForm(false);
        resetForm();
        fetchTemplates();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create template');
    }
    setCreating(false);
  };

  const handleDelete = async (template: WhatsAppTemplate) => {
    setDeleting(template.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const qs = new URLSearchParams({ name: template.name, id: template.id });
      const deleteRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?${qs.toString()}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...actingHeaders(),
          },
        }
      );
      const data = await deleteRes.json().catch(() => ({}));
      if (deleteRes.ok && data?.success !== false && !data?.error) {
        toast.success('Template deleted');
        // Remove immediately; Meta's list API can lag a moment behind.
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
        setTimeout(fetchTemplates, 1200);
      } else {
        toast.error(
          data?.error?.error_user_msg || data?.error?.message ||
          (typeof data?.error === 'string' ? data.error : 'Failed to delete'),
          { duration: 12000 }
        );
        // Keep the list truthful: the template is still live on WhatsApp.
        fetchTemplates();
      }

    } catch (error) {
      toast.error('Failed to delete template');
    }
    setDeleting(null);
  };


  const resetForm = () => {
    setName('');
    setCategory('MARKETING');
    setLanguage('en_US');
    setHeaderText('');
    setBodyText('');
    setFooterText('');
    setHeaderExample([]);
    setBodyExample([]);
    setButtons([]);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'default';
      case 'PENDING': return 'secondary';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 1500);
  };

  const ORDER_CONFIRMATION_TEMPLATE = {
    name: 'order_confirmation',
    category: 'UTILITY',
    language: 'en_US',
    body: 'Hi {{1}}, your order #{{2}} has been received. Total: {{3}}. We\'ll notify you when it ships.',
  };

  const [submittingOrderTemplate, setSubmittingOrderTemplate] = useState(false);

  const orderTemplateExists = templates.some(
    (t) => t.name === ORDER_CONFIRMATION_TEMPLATE.name
  );
  const orderTemplate = templates.find((t) => t.name === ORDER_CONFIRMATION_TEMPLATE.name);

  const submitOrderConfirmationTemplate = async () => {
    setSubmittingOrderTemplate(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: ORDER_CONFIRMATION_TEMPLATE.name,
            category: ORDER_CONFIRMATION_TEMPLATE.category,
            language: ORDER_CONFIRMATION_TEMPLATE.language,
            components: [{ type: 'BODY', text: ORDER_CONFIRMATION_TEMPLATE.body, example: { body_text: [['Sarah', '1042', '$45.00']] } }],
          }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) {
        const msg =
          data?.error?.error_user_msg ||
          data?.error?.message ||
          (typeof data?.error === 'string' ? data.error : null) ||
          `Failed (${resp.status})`;
        toast.error(msg);
      } else {
        toast.success('Template submitted to Meta for approval');
        fetchTemplates();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit template');
    }
    setSubmittingOrderTemplate(false);
  };

  const [submittingReminder, setSubmittingReminder] = useState(false);
  const reminderExists = reminderCfg ? templates.some((t) => t.name === reminderCfg.name) : false;
  const reminderTemplate = reminderCfg ? templates.find((t) => t.name === reminderCfg.name) : undefined;

  const submitReminderTemplate = async () => {
    if (!reminderCfg) return;
    setSubmittingReminder(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: reminderCfg.name,
            category: 'UTILITY',
            language: 'en_US',
            components: [
              { type: 'BODY', text: reminderCfg.body, example: { body_text: [reminderCfg.example] } },
              { type: 'BUTTONS', buttons: [
                { type: 'QUICK_REPLY', text: 'Confirm' },
                { type: 'QUICK_REPLY', text: 'Reschedule' },
                { type: 'QUICK_REPLY', text: 'Cancel' },
              ] },
            ],
          }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) {
        const msg = data?.error?.error_user_msg || data?.error?.message ||
          (typeof data?.error === 'string' ? data.error : null) || `Failed (${resp.status})`;
        toast.error(msg);
      } else {
        toast.success('Reminder template submitted to Meta for approval');
        fetchTemplates();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit template');
    }
    setSubmittingReminder(false);
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Create and manage WhatsApp message templates for outbound messaging.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTemplates} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
      </div>

      {/* Shopify Order Confirmation — Copy-paste ready */}
      {vertical === 'ecommerce' && (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Shopify Order Confirmation
          </CardTitle>
          <CardDescription className="text-xs">
            Copy these fields exactly into your Meta Business Manager to submit for approval. Once approved, every new Shopify order will automatically trigger a WhatsApp confirmation to the customer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Template name</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 font-mono">{ORDER_CONFIRMATION_TEMPLATE.name}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(ORDER_CONFIRMATION_TEMPLATE.name, 'name')}>
                  {copiedField === 'name' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 font-mono">{ORDER_CONFIRMATION_TEMPLATE.category}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(ORDER_CONFIRMATION_TEMPLATE.category, 'category')}>
                  {copiedField === 'category' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Language</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 font-mono">{ORDER_CONFIRMATION_TEMPLATE.language}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(ORDER_CONFIRMATION_TEMPLATE.language, 'language')}>
                  {copiedField === 'language' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Body text</Label>
            <div className="flex items-start gap-2">
              <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 font-mono leading-relaxed">{ORDER_CONFIRMATION_TEMPLATE.body}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleCopy(ORDER_CONFIRMATION_TEMPLATE.body, 'body')}>
                {copiedField === 'body' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <p><strong>{'{1}'}</strong> = Customer name &nbsp;|&nbsp; <strong>{'{2}'}</strong> = Order number &nbsp;|&nbsp; <strong>{'{3}'}</strong> = Total + currency</p>
            <p>Leave Header and Footer empty. No buttons needed.</p>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-primary/10">
            <div className="text-xs">
              {orderTemplateExists ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={statusColor(orderTemplate!.status) as any} className="text-[10px]">
                    {orderTemplate!.status}
                  </Badge>
                </div>
              ) : (
                <span className="text-muted-foreground">Not submitted yet</span>
              )}
            </div>
            <Button
              size="sm"
              onClick={submitOrderConfirmationTemplate}
              disabled={submittingOrderTemplate || orderTemplateExists}
            >
              {submittingOrderTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              {orderTemplateExists ? 'Already submitted' : 'Submit for approval'}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Appointment / Viewing Reminder (Wellness / Healthcare / Real Estate) */}
      {reminderCfg && (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            {reminderCfg.label}
          </CardTitle>
          <CardDescription className="text-xs">
            {reminderCfg.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Template name</Label>
              <code className="block text-xs bg-background border rounded px-2 py-1.5 font-mono">{reminderCfg.name}</code>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <code className="block text-xs bg-background border rounded px-2 py-1.5 font-mono">UTILITY</code>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Language</Label>
              <code className="block text-xs bg-background border rounded px-2 py-1.5 font-mono">en_US</code>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Body</Label>
            <code className="block text-xs bg-background border rounded px-2 py-1.5 font-mono leading-relaxed whitespace-pre-wrap">{reminderCfg.body}</code>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Buttons (quick replies)</Label>
            <div className="flex flex-wrap gap-2">
              {['Confirm', 'Reschedule', 'Cancel'].map((b) => (
                <span key={b} className="text-[11px] bg-background border rounded px-2 py-1 font-mono">{b}</span>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground">
            <strong>{'{1}'}</strong> = Customer name &nbsp;|&nbsp; <strong>{'{2}'}</strong> = {reminderCfg.secondLabel} &nbsp;|&nbsp; <strong>{'{3}'}</strong> = Date & time
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-primary/10">
            <div className="text-xs">
              {reminderExists ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={statusColor(reminderTemplate!.status) as any} className="text-[10px]">
                    {reminderTemplate!.status}
                  </Badge>
                </div>
              ) : (
                <span className="text-muted-foreground">Not submitted yet</span>
              )}
            </div>
            <Button size="sm" onClick={submitReminderTemplate} disabled={submittingReminder || reminderExists}>
              {submittingReminder ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              {reminderExists ? 'Already submitted' : 'Submit for approval'}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Create Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Create Template</CardTitle>
            <CardDescription className="text-xs">
              Templates are submitted to Meta for approval before they can be used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  placeholder="order_confirmation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Lowercase, underscores only</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Header (optional)</Label>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => addVariable('header')}>
                  <Braces className="h-3 w-3 mr-1" />
                  Add variable
                </Button>
              </div>
              <Input
                placeholder="Your Order Update"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                className="text-sm"
              />
              {headerVars > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] text-muted-foreground">Sample value for the header variable</p>
                  <Input
                    placeholder="Sample for {{1}}"
                    value={headerExample[0] || ''}
                    onChange={(e) => setHeaderExample([e.target.value])}
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body <span className="text-destructive">*</span></Label>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => addVariable('body')}>
                  <Braces className="h-3 w-3 mr-1" />
                  Add variable
                </Button>
              </div>
              <Textarea
                placeholder="Hello {{1}}, your order {{2}} has been shipped!"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={4}
                className="resize-none text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Use {'{{1}}'}, {'{{2}}'} etc. for dynamic variables
              </p>
              {bodyVars > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] text-muted-foreground">
                    Meta requires a sample value for each variable
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from({ length: bodyVars }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <code className="text-[10px] font-mono text-muted-foreground shrink-0">{`{{${i + 1}}}`}</code>
                        <Input
                          placeholder={`Sample ${i + 1}`}
                          value={bodyExample[i] || ''}
                          onChange={(e) =>
                            setBodyExample((prev) => {
                              const next = [...prev];
                              next[i] = e.target.value;
                              return next;
                            })
                          }
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Footer (optional)</Label>
              <Input
                placeholder="Reply STOP to unsubscribe"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Buttons */}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="text-xs">Buttons (optional)</Label>
                  <p className="text-[10px] text-muted-foreground">Up to 3 buttons — 1 link and 1 call button max</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => addButton('QUICK_REPLY')}>
                    <MessageSquare className="h-3 w-3 mr-1" /> Quick reply
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => addButton('URL')}>
                    <LinkIcon className="h-3 w-3 mr-1" /> Link
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => addButton('PHONE_NUMBER')}>
                    <Phone className="h-3 w-3 mr-1" /> Call
                  </Button>
                </div>
              </div>

              {buttons.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No buttons added.</p>
              ) : (
                <div className="space-y-2">
                  {buttons.map((b, i) => (
                    <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <Badge variant="secondary" className="text-[10px] w-fit shrink-0">
                        {b.type === 'QUICK_REPLY' ? 'Quick reply' : b.type === 'URL' ? 'Link' : 'Call'}
                      </Badge>
                      <Input
                        placeholder="Button label"
                        maxLength={25}
                        value={b.text}
                        onChange={(e) => updateButton(i, { text: e.target.value })}
                        className="text-sm"
                      />
                      {b.type !== 'QUICK_REPLY' && (
                        <Input
                          placeholder={b.type === 'URL' ? 'https://example.com/track' : '+9611234567'}
                          value={b.value}
                          onChange={(e) => updateButton(i, { value: e.target.value })}
                          className="text-sm"
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove button"
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeButton(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live preview */}
            {(headerText || bodyText || footerText || buttons.length > 0) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Preview</Label>
                <div className="rounded-lg bg-muted p-3 space-y-1.5">
                  {headerText && <p className="text-sm font-semibold">{headerText}</p>}
                  {bodyText && <p className="text-sm whitespace-pre-wrap">{bodyText}</p>}
                  {footerText && <p className="text-[11px] text-muted-foreground">{footerText}</p>}
                  {buttons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {buttons.map((b, i) => (
                        <span key={i} className="rounded-md border bg-background px-2 py-1 text-[11px] text-primary">
                          {b.text || 'Button'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}


            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={creating || !name.trim() || !bodyText.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Submit for Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No templates yet</p>
          <p className="text-xs mt-1">Create a template to start sending outbound messages.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <Badge variant={statusColor(t.status) as any} className="text-[10px] shrink-0">
                      {t.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{t.category}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{t.language}</span>
                  </div>
                  {t.components?.find((c: any) => c.type === 'BODY') && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {t.components.find((c: any) => c.type === 'BODY')?.text}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  disabled={deleting === t.id}
                  onClick={() => handleDelete(t)}
                >
                  {deleting === t.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
