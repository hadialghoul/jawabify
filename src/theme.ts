export const colors = {
  background: '#F7F7FC',
  foreground: '#0C0C1C',
  card: '#FFFFFF',
  cardForeground: '#0C0C1C',
  primary: '#4F46E5',
  primaryForeground: '#FFFFFF',
  primarySoft: '#EEF2FF',
  secondary: '#F1F1F6',
  secondaryForeground: '#1E1B4B',
  muted: '#F1F1F6',
  mutedForeground: '#616178',
  accent: '#F5F3FF',
  accentForeground: '#4338CA',
  destructive: '#F04444',
  destructiveForeground: '#FFFFFF',
  border: '#E6E6EE',
  input: '#E6E6EE',
  ring: '#4F46E5',
  header: '#11112C',
  headerForeground: '#FFFFFF',
  chatBg: '#F1F1F6',
  messageSent: '#4F46E5',
  messageSentForeground: '#FFFFFF',
  messageReceived: '#FFFFFF',
  messageReceivedForeground: '#0C0C1C',
  online: '#2ECF8F',
  overlay: 'rgba(12, 12, 28, 0.45)',
  amber: '#D97706',
  amberSoft: 'rgba(217, 119, 6, 0.12)',
  success: '#059669',
  successSoft: 'rgba(5, 150, 105, 0.12)',
};

export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  full: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const avatarPalette = [
  { bg: '#FFE4E6', fg: '#BE123C' },
  { bg: '#FEF3C7', fg: '#B45309' },
  { bg: '#D1FAE5', fg: '#047857' },
  { bg: '#E0F2FE', fg: '#0369A1' },
  { bg: '#EDE9FE', fg: '#6D28D9' },
  { bg: '#FAE8FF', fg: '#A21CAF' },
  { bg: '#CFFAFE', fg: '#0E7490' },
  { bg: '#E0E7FF', fg: '#4338CA' },
];

export function avatarColor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return avatarPalette[h % avatarPalette.length];
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
