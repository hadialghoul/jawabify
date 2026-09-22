import { useState } from 'react';
import { Headphones, Phone, Mail, X } from 'lucide-react';

export function SupportFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-6 right-6 z-10">
      {open ? (
        <div className="w-72 rounded-2xl border bg-card shadow-lg p-4 animate-scale-in origin-bottom-right">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">Need a hand getting started?</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Book a free onboarding call with our team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors -mt-1 -mr-1 p-1 rounded-md hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <a
              href="tel:+971523506806"
              className="inline-flex items-center gap-2 rounded-lg bg-background border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Phone className="h-4 w-4 text-primary" />
              +971 52 350 6806
            </a>
            <a
              href="mailto:support@jawabify.com"
              className="inline-flex items-center gap-2 rounded-lg bg-background border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Mail className="h-4 w-4 text-primary" />
              support@jawabify.com
            </a>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform animate-fade-in"
          aria-label="Need help? Contact us"
          title="Need help? Contact us"
          data-tour="contact-us"
        >
          <Headphones className="h-5 w-5" />
          <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ripple" />
        </button>
      )}
    </div>
  );
}
