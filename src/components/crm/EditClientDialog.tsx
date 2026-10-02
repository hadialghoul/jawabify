import { useEffect, useState, KeyboardEvent } from 'react';
import { Contact } from '@/types/chat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Save, Mail, MapPin, Phone, Tag, StickyNote, UserRound } from 'lucide-react';

export interface ClientEdits {
  name: string;
  phoneNumber: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  tags: string[];
}

interface Props {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (contactId: string, edits: ClientEdits) => void;
}

export function EditClientDialog({ contact, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState(contact.name || '');
  const [phone, setPhone] = useState(contact.phoneNumber || '');
  const [email, setEmail] = useState(contact.email ?? '');
  const [address, setAddress] = useState(contact.address ?? '');
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [tags, setTags] = useState<string[]>(contact.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(contact.name || '');
    setPhone(contact.phoneNumber || '');
    setEmail(contact.email ?? '');
    setAddress(contact.address ?? '');
    setNotes(contact.notes ?? '');
    setTags(contact.tags ?? []);
    setTagInput('');
  }, [contact.id, open]);

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput('');
  };

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleSave = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      toast({ title: 'Phone number is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim() || cleanPhone,
      phone_number: cleanPhone,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      tags,
    };
    const { error } = await supabase.from('contacts').update(payload as any).eq('id', contact.id);
    setSaving(false);
    if (error) {
      toast({
        title: 'Could not save',
        description: error.message.includes('duplicate')
          ? 'Another client already uses this phone number.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }
    onSaved(contact.id, {
      name: payload.name,
      phoneNumber: cleanPhone,
      email: payload.email,
      address: payload.address,
      notes: payload.notes,
      tags,
    });
    toast({ title: 'Client updated' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4" /> Edit client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone" className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone
            </Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9613xxxxxx"
              inputMode="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email" className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
            </Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-address" className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Address
            </Label>
            <Textarea
              id="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="Street, city, country"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-tags" className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" /> Tags
            </Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      className="rounded hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Input
              id="edit-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKey}
              onBlur={() => addTag(tagInput)}
              placeholder="Type a tag and press Enter"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes" className="flex items-center gap-2">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" /> Notes
            </Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Internal notes about this client"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
