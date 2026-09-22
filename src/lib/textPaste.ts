/**
 * Cleans text pasted from other apps (WhatsApp, Word, browsers) so that
 * RTL/LTR mixed phrases keep their original visual order.
 *
 * Removes invisible Unicode bidi control characters (LRM, RLM, ALM, embedding
 * and isolate marks) that reorder words when re-rendered, plus zero-width
 * characters and non-breaking spaces that break word wrapping.
 */
const BIDI_CONTROLS = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g;
const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF]/g;

export function sanitizePastedText(input: string): string {
  return input
    .replace(BIDI_CONTROLS, '')
    .replace(ZERO_WIDTH, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n?/g, '\n');
}

/**
 * Paste handler for inputs/textareas: inserts sanitized text at the caret.
 */
export function handleSanitizedPaste(
  e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  setValue: (next: string) => void,
) {
  const pasted = e.clipboardData.getData('text/plain');
  if (!pasted) return;
  e.preventDefault();
  const el = e.currentTarget;
  const clean = sanitizePastedText(pasted);
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + clean + el.value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    const caret = start + clean.length;
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      /* noop */
    }
  });
}
