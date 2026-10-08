export async function invokeErrorMessage(error: any, data?: any): Promise<string> {
  if (data?.error && typeof data.error === 'string') return data.error;
  const ctx = error?.context;
  if (ctx) {
    try {
      if (typeof ctx.json === 'function') {
        const payload = await ctx.json();
        if (payload?.error) return String(payload.error);
      }
    } catch {}
    try {
      if (typeof ctx.text === 'function') {
        const text = await ctx.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) return String(parsed.error);
        } catch {}
        if (text) return text.slice(0, 300);
      }
    } catch {}
  }
  return error?.message || 'Request failed';
}