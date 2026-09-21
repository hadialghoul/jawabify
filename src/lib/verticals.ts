export type Vertical =
  | 'ecommerce'
  | 'restaurant'
  | 'real_estate'
  | 'wellness'
  | 'healthcare'
  | 'education'
  | 'service';

export interface VerticalMeta {
  id: Vertical;
  label: string;
  emoji: string;
  tagline: string;
}

export const VERTICALS: VerticalMeta[] = [
  { id: 'ecommerce', label: 'E-Commerce', emoji: '🛍️', tagline: 'AI takes orders on WhatsApp.' },
  { id: 'restaurant', label: 'Restaurant', emoji: '🍽️', tagline: 'Menu, bills and table reservations.' },
  { id: 'real_estate', label: 'Real Estate', emoji: '🏠', tagline: 'Qualifies leads and books viewings.' },
  { id: 'wellness', label: 'Wellness', emoji: '💆', tagline: 'Books appointments and reminders.' },
  { id: 'healthcare', label: 'Healthcare', emoji: '🏥', tagline: 'Triage, appointments, lab follow-ups.' },
  { id: 'education', label: 'Education', emoji: '🎓', tagline: 'Class info and registration.' },
  { id: 'service', label: 'Service Business', emoji: '🛎️', tagline: 'Any service you sell on WhatsApp.' },
];

export const verticalMeta = (id?: string | null): VerticalMeta =>
  VERTICALS.find((v) => v.id === id) ?? VERTICALS[0];
