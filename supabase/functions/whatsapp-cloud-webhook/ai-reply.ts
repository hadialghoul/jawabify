// Shared AI call helper for the vertical flows (service, wellness, education,
// healthcare, real estate). One bounded retry for transient gateway failures,
// and a fallback reply that fits the conversation.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Returns the Response on success, or null when the call failed.
// Only 429/5xx and network errors are retried (once, 800ms backoff).
export async function aiChat(
  body: Record<string, unknown>,
  label: string,
  apiKey: string,
): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) {
        console.error(`${label} AI error`, res.status, await res.text().catch(() => ""));
        return null;
      }
      console.error(`${label} AI transient error`, res.status, "attempt", attempt + 1);
    } catch (e) {
      console.error(`${label} AI network error (attempt ${attempt + 1})`, e);
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

// "Say that again" only after the bot has already replied; first-time
// contacts get a greeting in their language.
export function aiFallbackReply(history: { role: string; content: string }[], lastUserText: string): string {
  if (history.some((m) => m.role === "assistant")) return "Sorry, can you say that again?";
  const arabic = /[\u0600-\u06ff]/.test(lastUserText || "");
  return arabic
    ? "مرحباً! 👋 شكراً لتواصلك معنا. أخبرنا بما تحتاجه وسنساعدك فوراً."
    : "Hi! 👋 Thanks for reaching out. Tell us what you need and we'll help right away.";
}
