# Jawabify Color Scheme

> Last updated: 2026-09-21
> Source of truth: `src/index.css` (CSS variables) and `tailwind.config.ts`

---

## 1. Brand Identity

| Item | Value | Notes |
|------|-------|-------|
| Primary brand hue | Indigo 243° | Electric indigo `#4f46e5` |
| Brand accent / online indicator | Emerald `#38d295` | WhatsApp-style “online” dot |
| Headings font | **Urbanist** | Display / marketing headings |
| Body font | **Epilogue** | UI body copy, buttons, labels |
| Theme modes | Light + Dark | Auto / class-based toggle |

The visual direction is **Midnight Indigo**: clean, Apple-like minimal with an indigo primary and an emerald status accent.

---

## 2. CSS Variable Tokens (`:root` = Light mode)

| Token | HSL | Hex approx. | Usage |
|-------|-----|-------------|-------|
| `--background` | `240 33% 98%` | `#f8f8fb` | Page background |
| `--foreground` | `240 40% 8%` | `#0a0a1a` | Primary text |
| `--card` | `0 0% 100%` | `#ffffff` | Card surfaces |
| `--card-foreground` | `240 40% 8%` | `#0a0a1a` | Text on cards |
| `--popover` | `0 0% 100%` | `#ffffff` | Popover/dropdown surface |
| `--popover-foreground` | `240 40% 8%` | `#0a0a1a` | Text in popovers |
| `--primary` | `243 75% 59%` | `#4f46e5` | Buttons, links, active states |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Text on primary buttons |
| `--secondary` | `240 20% 96%` | `#f3f3f7` | Secondary buttons / chips |
| `--secondary-foreground` | `243 50% 20%` | `#1a1a4d` | Text on secondary surfaces |
| `--muted` | `240 20% 96%` | `#f3f3f7` | Muted backgrounds |
| `--muted-foreground` | `240 10% 42%` | `#6b6b7b` | Placeholder / secondary text |
| `--accent` | `243 100% 97%` | `#ebebff` | Highlighted accent background |
| `--accent-foreground` | `243 75% 40%` | `#3329c3` | Text on accent surfaces |
| `--destructive` | `0 84% 60%` | `#ef4444` | Delete / error actions |
| `--destructive-foreground` | `0 0% 100%` | `#ffffff` | Text on destructive buttons |
| `--border` | `240 15% 91%` | `#e1e1e8` | Borders, dividers |
| `--input` | `240 15% 91%` | `#e1e1e8` | Form input borders |
| `--ring` | `243 75% 59%` | `#4f46e5` | Focus rings |
| `--radius` | `0.9rem` | — | Global border-radius |

---

## 3. Dark Mode Tokens (`.dark`)

| Token | HSL | Hex approx. | Usage |
|-------|-----|-------------|-------|
| `--background` | `240 45% 4%` | `#070715` | Page background |
| `--foreground` | `240 20% 96%` | `#f3f3f7` | Primary text |
| `--card` | `240 40% 7%` | `#0d0d1f` | Card surfaces |
| `--card-foreground` | `240 20% 96%` | `#f3f3f7` | Text on cards |
| `--popover` | `240 40% 7%` | `#0d0d1f` | Popover/dropdown surface |
| `--popover-foreground` | `240 20% 96%` | `#f3f3f7` | Text in popovers |
| `--primary` | `243 85% 70%` | `#7c73ed` | Dark-mode primary (lighter for contrast) |
| `--primary-foreground` | `240 45% 4%` | `#070715` | Text on primary buttons |
| `--secondary` | `240 30% 12%` | `#151526` | Secondary surfaces |
| `--secondary-foreground` | `240 20% 96%` | `#f3f3f7` | Text on secondary surfaces |
| `--muted` | `240 30% 12%` | `#151526` | Muted backgrounds |
| `--muted-foreground` | `240 10% 65%` | `#9595a6` | Placeholder / secondary text |
| `--accent` | `243 60% 18%` | `#1e1854` | Accent background |
| `--accent-foreground` | `240 20% 96%` | `#f3f3f7` | Text on accent surfaces |
| `--destructive` | `0 70% 55%` | `#d73d3d` | Dark-mode destructive |
| `--destructive-foreground` | `0 0% 100%` | `#ffffff` | Text on destructive buttons |
| `--border` | `240 25% 15%` | `#131324` | Borders, dividers |
| `--input` | `240 25% 15%` | `#131324` | Form input borders |
| `--ring` | `243 85% 70%` | `#7c73ed` | Focus rings |

---

## 4. Chat-Specific Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--message-sent` | `#4f46e5` | `#4f46e5` | Outgoing message bubble background |
| `--message-sent-foreground` | `#ffffff` | `#ffffff` | Text on outgoing bubbles |
| `--message-received` | `#ffffff` | `#151526` | Incoming message bubble background |
| `--message-received-foreground` | `#0a0a1a` | `#f3f3f7` | Text on incoming bubbles |
| `--chat-bg` | `#f3f3f7` | `#080814` | Chat panel background |
| `--sidebar-bg` | `#ffffff` | `#0d0d1f` | Sidebar background |
| `--header-bg` | `#0a0a1a` | `#0d0d12` | Top header bar |
| `--header-foreground` | `#ffffff` | `#ffffff` | Header text/icons |
| `--online-indicator` | `#38d295` | `#38d295` | Online / active dot |
| `--typing-indicator` | `#4f46e5` | `#4f46e5` | Typing animation color |

---

## 5. Marketing Gradients & Effects

| Effect | Definition |
|--------|-----------|
| Hero glow | `radial-gradient(ellipse 80% 60% at 50% 0%, hsl(243 75% 59% / 0.18), transparent 70%)` |
| Primary gradient | `linear-gradient(135deg, hsl(243 75% 59%), hsl(258 80% 65%))` |
| Ink gradient | `linear-gradient(180deg, hsl(240 40% 8%), hsl(240 45% 4%))` |
| Elegant shadow | `0 20px 60px -25px hsl(243 75% 59% / 0.35)` |
| Card shadow | `0 1px 2px hsl(240 20% 20% / 0.04), 0 8px 24px -12px hsl(240 30% 20% / 0.08)` |
| Gradient text (light) | `linear-gradient(135deg, hsl(240 40% 8%), hsl(243 75% 45%))` |
| Gradient text (invert) | `linear-gradient(135deg, #fff, hsl(243 60% 80%))` |
| Glass (light) | `hsl(0 0% 100% / 0.6)` + blur + 1px `hsl(240 20% 90% / 0.6)` border |
| Glass dark | `hsl(240 40% 8% / 0.6)` + blur + 1px `hsl(240 30% 30% / 0.4)` border |
| Grid background | `hsl(240 15% 88%)` 48px grid lines, masked radial fade |

---

## 6. Tailwind Color Map

These classes are wired through `tailwind.config.ts`:

```
bg-background           → --background
bg-foreground           → --foreground
bg-card                 → --card
bg-primary              → --primary
bg-primary-foreground   → --primary-foreground
bg-secondary            → --secondary
bg-muted                → --muted
bg-accent               → --accent
bg-destructive          → --destructive
border-border           → --border
ring-ring               → --ring
text-muted-foreground   → --muted-foreground
bg-message-sent         → --message-sent
bg-message-received     → --message-received
bg-chat-bg              → --chat-bg
bg-online               → --online-indicator
```

---

## 7. One-Line Reference

```
Primary Indigo : #4f46e5  (hsl 243 75% 59%)
Dark Background: #070715  (hsl 240 45% 4%)
Light Background:#f8f8fb  (hsl 240 33% 98%)
Text Dark      : #0a0a1a  (hsl 240 40% 8%)
Text Light     : #f3f3f7  (hsl 240 20% 96%)
Success/Emerald: #38d295  (hsl 158 64% 52%)
Danger         : #ef4444  (destructive)
White          : #ffffff
```

---

## 8. How to Add a New Color

1. Add the raw HSL variable to `:root` (and `.dark` if it changes in dark mode) in `src/index.css`.
2. Map it in `tailwind.config.ts` under `theme.extend.colors`.
3. Use only the semantic Tailwind class (e.g. `bg-my-new-color`) — never hardcode hex or RGB in components.
