import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Safety net for stuck page scroll.
 *
 * Radix dialogs/sheets/drawers lock body scroll (`overflow: hidden`,
 * `pointer-events: none`, `data-scroll-locked`). If one unmounts during a route
 * change or a fast open/close, the lock can survive and the page feels frozen.
 * This guard clears leftover locks whenever no modal is actually on screen.
 */
function clearStaleScrollLock() {
  const body = document.body;
  const hasOpenOverlay = document.querySelector(
    '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"], [data-radix-popper-content-wrapper] [data-state="open"], [vaul-drawer][data-state="open"]'
  );
  if (hasOpenOverlay) return;

  if (body.hasAttribute("data-scroll-locked")) body.removeAttribute("data-scroll-locked");
  if (body.style.overflow === "hidden") body.style.removeProperty("overflow");
  if (body.style.pointerEvents === "none") body.style.removeProperty("pointer-events");
  if (body.style.position === "fixed") {
    body.style.removeProperty("position");
    body.style.removeProperty("top");
    body.style.removeProperty("left");
    body.style.removeProperty("right");
    body.style.removeProperty("width");
  }
  if (body.style.paddingRight) body.style.removeProperty("padding-right");
  if (document.documentElement.style.overflow === "hidden") {
    document.documentElement.style.removeProperty("overflow");
  }
}

export default function ScrollLockGuard() {
  const location = useLocation();

  // Re-check after every navigation (and shortly after, once overlays unmount).
  useEffect(() => {
    clearStaleScrollLock();
    const t = window.setTimeout(clearStaleScrollLock, 400);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.search]);

  // Re-check when the tab regains focus / visibility, a common way to get stuck.
  useEffect(() => {
    const onWake = () => clearStaleScrollLock();
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);

    // Debounced: give overlays time to mount before deciding a lock is stale.
    let pending: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(clearStaleScrollLock, 350);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["style", "data-scroll-locked"] });

    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
      window.clearTimeout(pending);
      observer.disconnect();
    };
  }, []);

  return null;
}
