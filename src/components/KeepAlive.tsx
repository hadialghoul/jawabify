import { useEffect, useRef, type ReactNode } from "react";

/**
 * Keeps a panel mounted after its first activation so switching tabs
 * doesn't unmount/refetch/reset it. Inactive panels are hidden with CSS.
 */
export function KeepAlive({
  active,
  children,
  className = "h-full",
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  const mounted = useRef(active);
  if (active) mounted.current = true;

  // Ensure re-render keeps ref truthy across strict-mode double invokes
  useEffect(() => {
    if (active) mounted.current = true;
  }, [active]);

  if (!mounted.current) return null;

  return (
    <div className={active ? className : "hidden"} aria-hidden={!active}>
      {children}
    </div>
  );
}

export default KeepAlive;
