export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const sanitizeQuery = (v: string) =>
  v
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim();

export const digitsOnly = (v: string) => sanitizeQuery(v).replace(/\D/g, '');

export const normalizePhoneQuery = (v: string) => {
  let d = digitsOnly(v);
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d;
};
