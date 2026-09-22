import { Waves } from 'lucide-react';
import { SupportFab } from "@/components/chat/SupportFab";

export function EmptyChat() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-muted/30 p-8">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 mb-6">
        <Waves className="h-12 w-12 text-primary" />
        <div className="absolute h-full w-full rounded-full border-2 border-primary/20 animate-ripple" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to Jawabify</h2>
      <p className="text-center text-muted-foreground max-w-md">
        Smart customer messaging powered by AI. Select a conversation from the sidebar to start connecting.
      </p>

      <SupportFab />
    </div>
  );
}
