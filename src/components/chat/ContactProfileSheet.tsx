import { useEffect, useState, KeyboardEvent } from 'react';
import { Contact } from '@/types/chat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Phone, Save, X, Mail, MapPin, Tag, StickyNote } from 'lucide-react';

interface ContactCrmUpdates {
  name?: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  tags?: string[];
}

interface ContactProfileSheetProps {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateContact: (contactId: string, updates: ContactCrmUpdates | string) => Promise<boolean>;
}

export function ContactProfileSheet({
  contact,
  open,
  onOpenChange,
  onUpdateContact,
}: ContactProfileSheetProps) {
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email ?? '');
  const [address, setAddress] = useState(contact.address ?? '');
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [tags, setTags] = useState<string[]>(contact.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(contact.name);
    setEmail(contact.email ?? '');
    setAddress(contact.address ?? '');
    setNotes(contact.notes ?? '');
    setTags(contact.tags ?? []);
    setTagInput('');
  }, [contact.id, contact.name, contact.email, contact.address, contact.notes, contact.tags]);

  const getInitials = (n: string) =>
    n.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (tags.includes(t)) return;
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

  const dirty =
    name.trim() !== contact.name ||
    email !== (contact.email ?? '') ||
    address !== (contact.address ?? '') ||
    notes !== (contact.notes ?? '') ||
    JSON.stringify(tags) !== JSON.stringify(contact.tags ?? []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const ok = await onUpdateContact(contact.id, {
      name: name.trim(),
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      tags,
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Customer Profile</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-col items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>

          <div className="w-full space-y-5">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone
              </Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <span>{contact.phoneNumber}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email" className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-address" className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Address
              </Label>
              <Textarea
                id="contact-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, country"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-tags" className="flex items-center gap-2">
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
                id="contact-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                onBlur={() => addTag(tagInput)}
                placeholder="Type tag and press Enter"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-notes" className="flex items-center gap-2">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground" /> Notes
              </Label>
              <Textarea
                id="contact-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this customer"
                rows={4}
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !name.trim() || !dirty}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
