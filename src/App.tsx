import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { isEmbeddedShopify, readShopFromUrl, withShop } from "@/lib/shopifyEmbedded";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense, useEffect, useState } from "react";
import ConsultationPopup from "@/components/ConsultationPopup";
import ScrollLockGuard from "@/components/ScrollLockGuard";
import { trackPageView } from "@/lib/analytics";
import Home from "./pages/marketing/Home";



// Auto-recover from stale chunk errors after a redeploy.
// If a dynamic import fails (old hashed chunk no longer exists), reload once.
function lazyWithRetry<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    const isChunkError = (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Loading chunk|ChunkLoadError/i.test(msg);
    };
    try {
      return await factory();
    } catch (err) {
      if (!isChunkError(err)) throw err;
      // Retry once in-place (network blip)
      try {
        await new Promise((r) => setTimeout(r, 300));
        return await factory();
      } catch (err2) {
        if (!isChunkError(err2)) throw err2;
        // Stale deploy — hard reload, bypassing cache. Throttle to avoid loops.
        const key = '__lovable_chunk_reload_at__';
        const last = Number(sessionStorage.getItem(key) || '0');
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw err2;
      }
    }
  });
}

const Index = lazyWithRetry(() => import("./pages/Index"));
const Features = lazyWithRetry(() => import("./pages/marketing/Features"));
const HowItWorks = lazyWithRetry(() => import("./pages/marketing/HowItWorks"));
const Industries = lazyWithRetry(() => import("./pages/marketing/Industries"));
const Pricing = lazyWithRetry(() => import("./pages/marketing/Pricing"));
const About = lazyWithRetry(() => import("./pages/marketing/About"));
const FAQ = lazyWithRetry(() => import("./pages/marketing/FAQ"));
const Contact = lazyWithRetry(() => import("./pages/marketing/Contact"));
const WhatsAppApiGuide = lazyWithRetry(() => import("./pages/marketing/WhatsAppApiGuide"));
const WhatsAppPricingGuide = lazyWithRetry(() => import("./pages/marketing/WhatsAppPricingGuide"));
const Info = lazyWithRetry(() => import("./pages/Info"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Integrations = lazyWithRetry(() => import("./pages/Integrations"));
const Account = lazyWithRetry(() => import("./pages/Account"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const SuperAdmin = lazyWithRetry(() => import("./pages/SuperAdmin"));
const Unsubscribe = lazyWithRetry(() => import("./pages/Unsubscribe"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Subscribe = lazyWithRetry(() => import("./pages/Subscribe"));
const ShopifyConnect = lazyWithRetry(() => import("./pages/ShopifyConnect"));
const CheckoutReturn = lazyWithRetry(() => import("./pages/CheckoutReturn"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const Tutorials = lazyWithRetry(() => import("./pages/Tutorials"));
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"));
const Sandbox = lazyWithRetry(() => import("./pages/Sandbox"));
const BookConsultation = lazyWithRetry(() => import("./pages/BookConsultation"));
const LeadForm = lazyWithRetry(() => import("./pages/LeadForm"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const RouteFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="text-muted-foreground text-sm">Loading...</div>
  </div>
);

const APP_HISTORY_LOCK_KEY = 'jawabify_app_history_locked';

const RootRoute = () => {
  const { user, tenantId, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    // If Supabase auth params landed on "/" instead of the callback route,
    // hand them to the dedicated callback so verification finishes cleanly.
    const search = window.location.search;
    const hash = window.location.hash;
    if (
      search.includes('code=') ||
      search.includes('token_hash=') ||
      hash.includes('access_token') ||
      hash.includes('type=recovery')
    ) {
      navigate(`/auth/callback${search}${hash}`, { replace: true });
      return;
    }
    if (!user) return;
    // Only auto-redirect authenticated users into the app on tabs that entered
    // the authenticated app flow. Fresh tabs opened to "/" should render the
    // marketing homepage while keeping the shared auth session available.
    const appHistoryLocked = window.sessionStorage.getItem(APP_HISTORY_LOCK_KEY) === 'true';
    if (!appHistoryLocked) return;
    if (isSuperAdmin) navigate('/super-admin', { replace: true });
    else if (tenantId) navigate('/app', { replace: true });
    else navigate('/onboarding', { replace: true });
  }, [user, tenantId, isSuperAdmin, loading, navigate]);
  return <Home />;
};

/**
 * Shopify policy 1.2.1 / 1.1.1 lock.
 *
 * While the app renders inside the Shopify Admin, the ONLY reachable screens are
 * the connector page and the legal pages. Every other route (pricing, subscribe,
 * settings, checkout return, marketing pages) is redirected to the connector, so
 * a store that installed from the App Store can never reach a card form or any
 * off-platform checkout. Detection is URL/frame based — nothing is persisted, so
 * this works with third-party cookies and storage blocked.
 */
const EMBEDDED_ALLOWED_PATHS = ['/shopify/connect', '/privacy', '/terms'];

const EmbeddedShopifyLock = () => {
  const location = useLocation();
  if (!isEmbeddedShopify()) return null;
  if (EMBEDDED_ALLOWED_PATHS.includes(location.pathname)) return null;
  return <Navigate to={withShop('/shopify/connect', readShopFromUrl())} replace />;
};

const AppRoutes = () => {

  const { user, tenantId, isSuperAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [historyNavigationCount, setHistoryNavigationCount] = useState(0);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handlePopState = () => setHistoryNavigationCount((count) => count + 1);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  useEffect(() => {
    if (loading || !user) return;
    const appHistoryLocked = window.sessionStorage.getItem(APP_HISTORY_LOCK_KEY) === 'true';
    if (appHistoryLocked && historyNavigationCount > 0 && (location.pathname === '/' || location.pathname === '/auth')) {
      if (isSuperAdmin) navigate('/super-admin', { replace: true });
      else if (tenantId) navigate('/app', { replace: true });
      else navigate('/onboarding', { replace: true });
    }
  }, [loading, user, tenantId, isSuperAdmin, location.pathname, historyNavigationCount, navigate]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <ScrollLockGuard />
      <EmbeddedShopifyLock />
      {!isEmbeddedShopify() && <ConsultationPopup />}
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Privacy />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/shopify/connect" element={<ShopifyConnect />} />
        <Route path="/checkout/return" element={<CheckoutReturn />} />
        <Route path="/app" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/" element={<RootRoute />} />
        <Route path="/features" element={<Features />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/industries" element={<Industries />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/book-consultation" element={<BookConsultation />} />
        <Route path="/form" element={<LeadForm />} />
        <Route path="/blog/whatsapp-business-api-guide" element={<WhatsAppApiGuide />} />
        <Route path="/blog/whatsapp-conversation-pricing-guide" element={<WhatsAppPricingGuide />} />
        <Route path="/info" element={<Info />} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />

        <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="/tutorials" element={<ProtectedRoute><Tutorials /></ProtectedRoute>} />
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/sandbox" element={<Sandbox />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);


export default App;
