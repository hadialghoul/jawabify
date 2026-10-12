export type PasswordResetLink = {
  rt?: string;
  tokenHash?: string;
  code?: string;
  errorDescription?: string;
};

function isResetPath(url: URL): boolean {
  const host = url.hostname.replace(/^www\./, '');
  if (url.protocol === 'https:' || url.protocol === 'http:') {
    return host === 'app.jawabify.com' && url.pathname.startsWith('/reset-password');
  }
  if (url.protocol === 'jawabify:') {
    return host === 'reset-password' || url.pathname.includes('reset-password');
  }
  return false;
}

/** Pull a reset link out of an app or website URL. Returns null for unrelated links. */
export function parsePasswordResetLink(raw: string | null | undefined): PasswordResetLink | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!isResetPath(url)) return null;
  const rt = url.searchParams.get('rt') || undefined;
  const tokenHash = url.searchParams.get('token_hash') || undefined;
  const code = url.searchParams.get('code') || undefined;
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  const errorDescription =
    url.searchParams.get('error_description') || hashParams.get('error_description') || undefined;
  if (!rt && !tokenHash && !code && !errorDescription) return null;
  return { rt, tokenHash, code, errorDescription };
}
