"use client";

import type { BasketGroup } from "@/lib/types";
import { InfoButton } from "@/components/BasketInfoModal";

interface Props {
  baskets: Record<string, BasketGroup>;
  rangeEnd?: number;
}

export function BasketMomentum({ baskets, rangeEnd }: Props) {
  const basketKeys = Object.keys(baskets);

  const vals: (number | null)[] = basketKeys.map((bk) => {
    const b = baskets[bk];
    if (rangeEnd != null && b.index && rangeEnd < b.index.length) {
      const cur = b.index[rangeEnd];
      const prev = b.index[Math.max(0, rangeEnd - 13)];
      if (cur != null && prev != null && prev > 0) {
        return +((cur / prev - 1) * 100).toFixed(1);
      }
    }
    return b.momentum_latest;
  });

  const maxAbs = vals.reduce<number>((m, v) => (v != null ? Math.max(m, Math.abs(v)) : m), 0.1);

  return (
    <div className="space-y-3">
      {basketKeys.map((bk, i) => {
        const val = vals[i];
        if (val == null) return null;
        const pct = (Math.abs(val) / maxAbs) * 48;
        const color = val >= 0 ? "#4ade80" : "#f87171";
        const label = `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;

        return (
          <div key={bk} className="flex items-center gap-3">
            <div className="w-36 shrink-0 flex items-center gap-1 text-xs text-slate-300 min-w-0">
              <span className="truncate">{baskets[bk].label}</span>
              <InfoButton type="basket" basketKey={bk} />
            </div>
            <div className="relative flex-1 h-2 rounded-full bg-slate-800">
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-600" />
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
