import { verticalMeta } from "@/lib/verticals";

interface Props {
  vertical: string;
}

export function VerticalComingSoon({ vertical }: Props) {
  const meta = verticalMeta(vertical);
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className={`mx-auto inline-flex items-center justify-center w-16 h-16 rounded-2xl text-3xl ${meta.badgeBg}`}>
          {meta.emoji}
        </div>
        <h2 className={`text-2xl font-semibold ${meta.color}`}>{meta.label} workspace</h2>
        <p className="text-muted-foreground text-sm">{meta.tagline}</p>
        <p className="text-xs text-muted-foreground">
          We're tailoring the dashboard for your vertical. Your AI assistant and chats are already working —
          the vertical-specific tools (calendar, listings, intake forms, etc.) will appear here soon.
        </p>
      </div>
    </div>
  );
}
