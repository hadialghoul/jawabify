import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VERTICALS, type Vertical } from "@/lib/verticals";
import { Check } from "lucide-react";

interface Props {
  value: Vertical | null;
  onChange: (v: Vertical) => void;
  onContinue: () => void;
  onSignOut: () => void;
}

export function VerticalPicker({ value, onChange, onContinue, onSignOut }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 safe-top safe-bottom">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">What kind of business is this?</CardTitle>
          <CardDescription>
            Step 1 of 3 — we tailor the dashboard and the AI to fit your workflow. You can't change this later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {VERTICALS.map((v) => {
              const selected = value === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onChange(v.id)}
                  className={`relative text-left rounded-lg border-2 p-4 transition-all hover:border-primary/60 ${
                    selected ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className="text-2xl mb-2">{v.emoji}</div>
                  <div className="font-semibold text-sm">{v.label}</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{v.tagline}</p>
                </button>
              );
            })}
          </div>

          <Button className="w-full" disabled={!value} onClick={onContinue}>
            Continue
          </Button>

          <div className="text-center text-sm text-muted-foreground pt-1">
            <button
              type="button"
              onClick={onSignOut}
              className="text-primary hover:underline font-medium"
            >
              Sign out
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
