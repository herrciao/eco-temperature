"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Recharts needs a real browser layout width/height; skip SSR for chart trees.
 */
export function ClientOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) {
    return (
      fallback ?? (
        <div
          className="flex min-h-[280px] w-full min-w-0 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/30 text-sm text-slate-500"
          aria-hidden
        >
          載入圖表…
        </div>
      )
    );
  }
  return <>{children}</>;
}
