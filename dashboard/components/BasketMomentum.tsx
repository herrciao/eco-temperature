"use client";

import type { BasketGroup } from "@/lib/types";

interface Props {
  baskets: Record<string, BasketGroup>;
}

export function BasketMomentum({ baskets }: Props) {
  const basketKeys = Object.keys(baskets);
  const maxAbs = basketKeys.reduce((m, k) => {
    const v = baskets[k].momentum_latest;
    return v != null ? Math.max(m, Math.abs(v)) : m;
  }, 0.1);

  return (
    <div className="space-y-3">
      {basketKeys.map((bk) => {
        const val = baskets[bk].momentum_latest;
        if (val == null) return null;
        const pct = (Math.abs(val) / maxAbs) * 48; // max fill = 48% each side
        const color = val >= 0 ? "#4ade80" : "#f87171";
        const label = `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;

        return (
          <div key={bk} className="flex items-center gap-3">
            <div className="w-36 shrink-0 text-xs text-slate-300">{baskets[bk].label}</div>
            <div className="relative flex-1 h-2 rounded-full bg-slate-800">
              {/* Center marker */}
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-600" />
              {/* Fill */}
              <div
                className="absolute top-0 h-2 rounded-full"
                style={{
                  width: `${pct}%`,
                  left: val >= 0 ? "50%" : `calc(50% - ${pct}%)`,
                  background: color,
                }}
              />
            </div>
            <div
              className="w-14 shrink-0 text-right text-xs tabular-nums font-semibold"
              style={{ color }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
