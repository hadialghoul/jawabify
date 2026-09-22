import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface TourStep {
  id: string;
  target?: string; // CSS selector, omit for centered modal step
  title: string;
  body: string;
  action?: string; // hint text for what user can do
  /** Called before this step renders — used to open menus / switch tabs. */
  beforeShow?: () => void | Promise<void>;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
}

interface Props {
  steps: TourStep[];
  open: boolean;
  initialStep?: number;
  userId?: string | null;
  onClose: (completed: boolean) => void;
}

const PAD = 8;
const CARD_W = 340;
const CARD_H_EST = 280;

export function ProductTour({ steps, open, initialStep = 0, userId, onClose }: Props) {
  const [idx, setIdx] = useState(initialStep);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cancelRef = useRef(false);

  const step = steps[idx];

  // Log analytics
  const logEvent = useCallback(
    async (event: string, stepId?: string, stepIndex?: number) => {
      if (!userId) return;
      try {
        await supabase.from("tour_events").insert({
          user_id: userId,
          event,
          step_id: stepId ?? null,
          step_index: stepIndex ?? null,
        });
      } catch {
        /* non-blocking */
      }
    },
    [userId],
  );

  const persistStep = useCallback(
    async (nextIdx: number, completed = false) => {
      if (!userId) return;
      try {
        await supabase
          .from("profiles")
          .update({
            tour_step: nextIdx,
            ...(completed ? { tour_completed_at: new Date().toISOString() } : {}),
          })
          .eq("user_id", userId);
      } catch {
        /* non-blocking */
      }
    },
    [userId],
  );

  // Resize listener
  useEffect(() => {
    if (!open) return;
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setIdx(initialStep);
      cancelRef.current = false;
      logEvent("start", steps[initialStep]?.id, initialStep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Find target with polling
  useLayoutEffect(() => {
    if (!open || !step) return;
    cancelRef.current = false;
    setReady(false);
    setRect(null);

    let raf = 0;
    let cancelled = false;

    const run = async () => {
      if (step.beforeShow) {
        try {
          await step.beforeShow();
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;

      logEvent("view", step.id, idx);

      if (!step.target) {
        setReady(true);
        return;
      }

      const start = performance.now();
      const tick = () => {
        if (cancelled) return;
        const el = document.querySelector(step.target!) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          // Wait a frame to read updated rect
          requestAnimationFrame(() => {
            if (cancelled) return;
            setRect(el.getBoundingClientRect());
            setReady(true);
          });
          return;
        }
        if (performance.now() - start > 6000) {
          // Give up, show as centered
          setReady(true);
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    };

    run();

    return () => {
      cancelled = true;
      cancelRef.current = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open, idx, step, logEvent]);

  // Track target rect on scroll/resize
  useEffect(() => {
    if (!open || !step?.target || !ready) return;
    let raf = 0;
    const update = () => {
      const el = document.querySelector(step.target!) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    const loop = () => {
      update();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, step, ready]);

  if (!open || !step) return null;

  const isLast = idx === steps.length - 1;
  const isFirst = idx === 0;

  const handleNext = () => {
    if (isLast) {
      logEvent("complete", step.id, idx);
      persistStep(steps.length, true);
      onClose(true);
    } else {
      const next = idx + 1;
      logEvent("next", step.id, idx);
      persistStep(next);
      setIdx(next);
    }
  };
  const handlePrev = () => {
    if (isFirst) return;
    const next = idx - 1;
    logEvent("prev", step.id, idx);
    persistStep(next);
    setIdx(next);
  };
  const handleSkip = () => {
    logEvent("skip", step.id, idx);
    persistStep(steps.length, true);
    onClose(false);
  };

  // Compute tooltip position
  const { w: vw, h: vh } = viewport;
  let tipLeft = (vw - CARD_W) / 2;
  let tipTop = (vh - CARD_H_EST) / 2;
  let arrow: "top" | "bottom" | "left" | "right" | null = null;

  if (rect && step.target) {
    const place = step.placement ?? "auto";
    const candidates: Array<typeof arrow> = [];
    if (place === "auto") {
      candidates.push("bottom", "top", "right", "left");
    } else {
      candidates.push(place);
    }
    for (const p of candidates) {
      if (p === "bottom" && rect.bottom + CARD_H_EST + PAD < vh) {
        tipTop = rect.bottom + PAD;
        tipLeft = Math.min(Math.max(rect.left + rect.width / 2 - CARD_W / 2, PAD), vw - CARD_W - PAD);
        arrow = "top";
        break;
      }
      if (p === "top" && rect.top - CARD_H_EST - PAD > 0) {
        tipTop = rect.top - CARD_H_EST - PAD;
        tipLeft = Math.min(Math.max(rect.left + rect.width / 2 - CARD_W / 2, PAD), vw - CARD_W - PAD);
        arrow = "bottom";
        break;
      }
      if (p === "right" && rect.right + CARD_W + PAD < vw) {
        tipLeft = rect.right + PAD;
        tipTop = Math.min(Math.max(rect.top + rect.height / 2 - CARD_H_EST / 2, PAD), vh - CARD_H_EST - PAD);
        arrow = "left";
        break;
      }
      if (p === "left" && rect.left - CARD_W - PAD > 0) {
        tipLeft = rect.left - CARD_W - PAD;
        tipTop = Math.min(Math.max(rect.top + rect.height / 2 - CARD_H_EST / 2, PAD), vh - CARD_H_EST - PAD);
        arrow = "right";
        break;
      }
    }
    if (arrow === null) {
      // Fallback centered
      tipLeft = (vw - CARD_W) / 2;
      tipTop = vh - CARD_H_EST - PAD;
    }
  }

  // Mobile: full-width bottom sheet style
  const isMobile = vw < 640;
  const cardWidth = isMobile ? vw - PAD * 2 : CARD_W;
  if (isMobile) {
    tipLeft = PAD;
    if (rect && step.target) {
      // Place above or below the highlighted element depending on space
      if (rect.bottom + CARD_H_EST + PAD < vh) {
        tipTop = rect.bottom + PAD;
      } else if (rect.top - CARD_H_EST - PAD > 0) {
        tipTop = rect.top - CARD_H_EST - PAD;
      } else {
        tipTop = vh - CARD_H_EST - PAD;
      }
    } else {
      tipTop = vh - CARD_H_EST - PAD;
    }
  }

  const spotlight = rect && step.target
    ? {
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      }
    : null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Product tour"
    >
      {/* Dim layer using clip-path cutout */}
      {spotlight ? (
        <svg className="absolute inset-0 h-full w-full pointer-events-auto" style={{ pointerEvents: "auto" }}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={10}
                ry={10}
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="hsl(0 0% 0% / 0.6)" mask="url(#tour-mask)" />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
      )}

      {/* Spotlight ring */}
      {spotlight && (
        <div
          className="absolute pointer-events-none rounded-[10px] ring-2 ring-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.25)] animate-scale-in"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            transition: "all 220ms ease",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute z-[101] animate-fade-in"
        style={{
          top: tipTop,
          left: tipLeft,
          width: cardWidth,
          transition: "top 220ms ease, left 220ms ease",
        }}
      >
        <div className="relative rounded-xl border bg-card text-card-foreground shadow-2xl p-4 sm:p-5">
          {arrow && !isMobile && (
            <div
              className="absolute h-3 w-3 rotate-45 bg-card border-l border-t"
              style={{
                ...(arrow === "top" && { top: -6, left: "50%", marginLeft: -6 }),
                ...(arrow === "bottom" && { bottom: -6, left: "50%", marginLeft: -6, transform: "rotate(225deg)" }),
                ...(arrow === "left" && { left: -6, top: "50%", marginTop: -6, transform: "rotate(-45deg)" }),
                ...(arrow === "right" && { right: -6, top: "50%", marginTop: -6, transform: "rotate(135deg)" }),
              }}
            />
          )}

          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Step {idx + 1} of {steps.length}
                </p>
                <h3 className="font-semibold text-base leading-tight truncate">{step.title}</h3>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 -mr-1 -mt-1"
              onClick={handleSkip}
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
          {step.action && (
            <p className="mt-2 text-xs rounded-md bg-muted px-2.5 py-1.5 text-foreground/80">
              💡 {step.action}
            </p>
          )}

          {/* Progress bar */}
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((idx + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip tour
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrev} disabled={isFirst}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button size="sm" onClick={handleNext}>
                {isLast ? (
                  <>
                    Finish <Check className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
