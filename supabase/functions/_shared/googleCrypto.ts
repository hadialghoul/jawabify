// AES-256-GCM helpers for encrypting refresh tokens at rest.
// GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key
// (e.g. `openssl rand -base64 32`), set as a Supabase edge function secret.

async function importKey(): Promise<CryptoKey> {
  const b64 = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY");
  if (!b64) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Returns base64(iv (12 bytes) || ciphertext).
export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return toB64(combined);
}

export async function decryptSecret(encoded: string): Promise<string> {
  const key = await importKey();
  const combined = fromB64(encoded);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
