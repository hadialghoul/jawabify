import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, ArrowUpRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
const MARKETING_LOGO = "/apple-touch-icon.png?v=7";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/industries", label: "Industries" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
];

function Logo({ invert = false }: { invert?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 group" aria-label="Jawabify home">
      <img
        src={MARKETING_LOGO}
        alt="Jawabify brand emblem"
        width={36}
        height={36}
        loading="eager"
        decoding="sync"
        className={cn(
          "h-9 w-auto rounded-md object-contain",
          invert ? "" : "bg-[hsl(240_45%_5%)] p-1"
        )}
      />
    </Link>
  );
}

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <header className={cn(
      "fixed top-0 inset-x-0 z-50 transition-all duration-300",
      scrolled ? "bg-white/80 backdrop-blur-xl border-b border-border/60" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
        <Logo />
        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => cn(
                "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
                isActive
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-2">
          <Link
            to="/auth"
            className="inline-flex items-center rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/auth?mode=signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold hover:bg-foreground/90 transition-colors shadow-sm"
          >
            Start free trial <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <button
          aria-label="Toggle menu"
          className="lg:hidden p-2 rounded-lg hover:bg-secondary"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden border-t border-border bg-white/95 backdrop-blur-xl">
          <div className="px-5 py-4 flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => cn(
                  "px-3 py-2.5 rounded-lg text-sm font-medium",
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="h-px bg-border my-2" />
            <Link to="/auth" className="rounded-full border border-border bg-white text-center px-4 py-2.5 text-sm font-semibold text-foreground">Log in</Link>
            <Link
              to="/auth?mode=signup"
              className="mt-1 text-center rounded-full bg-foreground text-background px-4 py-2.5 text-sm font-semibold"
            >
              Start free trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="relative mt-24 bg-[hsl(240_45%_5%)] text-white/80 overflow-hidden">
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, hsl(243 75% 59% / 0.25), transparent 70%)" }}
      />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo invert />
            <p className="mt-4 max-w-sm text-sm text-white/75">
              The AI WhatsApp platform for modern businesses. Automate replies, take orders, and run campaigns — all in one inbox.
            </p>
            <div className="mt-4 text-sm text-white/70 space-y-1">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-white/90">Business Center, Sharjah Publishing City Free Zone</div>
                  <div className="text-white/60">Sharjah, United Arab Emirates</div>
                </div>
              </div>
            </div>
            <Link
              to="/auth?mode=signup"
              className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white text-[hsl(240_45%_5%)] px-4 py-2 text-sm font-semibold hover:bg-white/90"
            >
              Start free trial <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/70 mb-3">Product</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/features" className="hover:text-white">Features</Link></li>
              <li><Link to="/how-it-works" className="hover:text-white">How it works</Link></li>
              <li><Link to="/industries" className="hover:text-white">Industries</Link></li>
              <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/70 mb-3">Company</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-white">About</Link></li>
              <li><Link to="/faq" className="hover:text-white">FAQ</Link></li>
              <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
              <li><Link to="/blog/whatsapp-business-api-guide" className="hover:text-white">WhatsApp API guide</Link></li>
              <li><Link to="/privacy" className="hover:text-white">Privacy</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white/70">
          <div>© {new Date().getFullYear()} Jawabify. All rights reserved.</div>
          <div>Built for WhatsApp Business Cloud API</div>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MarketingNav />
      <main className="flex-1 pt-16">{children}</main>
      <MarketingFooter />
    </div>
  );
}
