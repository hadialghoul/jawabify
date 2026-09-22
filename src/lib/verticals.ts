export type Vertical =
  | "ecommerce"
  | "restaurant"
  | "real_estate"
  | "wellness"
  | "healthcare"
  | "education"
  | "service";

export interface VerticalMeta {
  id: Vertical;
  label: string;
  emoji: string;
  tagline: string;
  color: string; // hsl-friendly tailwind class for accent text
  badgeBg: string;
}

export const VERTICALS: VerticalMeta[] = [
  {
    id: "ecommerce",
    label: "E-Commerce",
    emoji: "🛍️",
    tagline: "AI takes orders on WhatsApp, fires them to Shopify or your sheet.",
    color: "text-emerald-700",
    badgeBg: "bg-emerald-50",
  },
  {
    id: "restaurant",
    label: "Restaurant",
    emoji: "🍽️",
    tagline: "Full cashier on WhatsApp — menu, bills to the kitchen, table reservations.",
    color: "text-orange-700",
    badgeBg: "bg-orange-50",
  },
  {
    id: "real_estate",
    label: "Real Estate",
    emoji: "🏠",
    tagline: "Qualifies leads, books viewings, hands hot ones to your agents.",
    color: "text-blue-700",
    badgeBg: "bg-blue-50",
  },
  {
    id: "wellness",
    label: "Wellness",
    emoji: "💆",
    tagline: "Books appointments, manages reschedules and reminders.",
    color: "text-purple-700",
    badgeBg: "bg-purple-50",
  },
  {
    id: "healthcare",
    label: "Healthcare",
    emoji: "🏥",
    tagline: "Triage, appointments, lab follow-ups — always escalates urgent cases.",
    color: "text-red-700",
    badgeBg: "bg-red-50",
  },
  {
    id: "education",
    label: "Education",
    emoji: "🎓",
    tagline: "Class info, registration, parent questions answered 24/7.",
    color: "text-yellow-700",
    badgeBg: "bg-yellow-50",
  },
  {
    id: "service",
    label: "Service Business",
    emoji: "🛎️",
    tagline: "For agencies, consultants, trainers, travel — any service you sell on WhatsApp.",
    color: "text-cyan-700",
    badgeBg: "bg-cyan-50",
  },
];

export const verticalMeta = (id?: string | null): VerticalMeta =>
  VERTICALS.find((v) => v.id === id) ?? VERTICALS[0];
