// Parse loose user input ("7 30", "730", "7:30", "7.30", "7", "7pm", "7:30 PM")
// into a strict "HH:mm" 24h string, or null if unparseable.
export function parseTimeInput(input: string): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  const ampm = /\b(am|pm)\b/.exec(s)?.[1] as "am" | "pm" | undefined;
  s = s.replace(/\b(am|pm)\b/g, "").replace(/\./g, ":").replace(/h/g, ":").trim();

  let h: number | null = null;
  let m: number | null = null;

  let match = /^(\d{1,2})\s*[:\s]\s*(\d{1,2})$/.exec(s);
  if (match) {
    h = +match[1]; m = +match[2];
  } else if (/^\d{3,4}$/.test(s)) {
    h = +s.slice(0, s.length - 2);
    m = +s.slice(-2);
  } else if (/^\d{1,2}$/.test(s)) {
    h = +s; m = 0;
  }

  if (h === null || m === null) return null;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTimeLabel(hhmm: string): string {
  return hhmm;
}
