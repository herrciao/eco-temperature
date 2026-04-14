"use client";

import { useState } from "react";
import type { PanelRow } from "@/lib/types";
import { REGIME_COLORS, regimeLabelZh } from "@/lib/regime";

function mergeRegimeSegments(
  panel: PanelRow[]
): { start: string; end: string; regime: string; weeks: number }[] {
  if (panel.length === 0) return [];
  const out: { start: string; end: string; regime: string; weeks: number }[] =
    [];
  let segStart = panel[0].week;
  let segRegime = panel[0].regime;
  let count = 1;
  for (let i = 1; i < panel.length; i++) {
    if (panel[i].regime !== segRegime) {
      out.push({
        start: segStart,
        end: panel[i - 1].week,
        regime: segRegime,
        weeks: count,
      });
      segStart = panel[i].week;
      segRegime = panel[i].regime;
      count = 1;
    } else {
      count += 1;
    }
  }
  out.push({
    start: segStart,
    end: panel[panel.length - 1].week,
    regime: segRegime,
    weeks: count,
  });
  return out;
}

export function RegimeTimeline({ panel }: { panel: PanelRow[] }) {
  const segments = mergeRegimeSegments(panel);
  const totalWeeks = panel.length || 1;
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4">
      <h3 className="mb-2 text-lg font-semibold text-slate-100">
        Regime 時間軸
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        每段寬度依持續週數比例；滑鼠懸停顯示區間與狀態。
      </p>
      <div
        className="relative flex h-10 w-full overflow-hidden rounded-lg ring-1 ring-slate-700/80"
        onMouseLeave={() => setHoverLabel(null)}
      >
        {segments.map((seg, i) => {
          const w = (seg.weeks / totalWeeks) * 100;
          const bg = REGIME_COLORS[seg.regime] ?? "#64748b";
          const zh = regimeLabelZh(seg.regime);
          return (
            <button
              key={`${seg.start}-${seg.regime}-${i}`}
              type="button"
              className="relative h-full min-w-[2px] border-r border-slate-950/40 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-400"
              style={{
                width: `${w}%`,
                backgroundColor: bg,
              }}
              title={`${seg.start} → ${seg.end} · ${zh}`}
              onMouseEnter={() =>
                setHoverLabel(
                  `${zh} · ${seg.start}～${seg.end}（${seg.weeks} 週）`
                )
              }
            />
          );
        })}
      </div>
      {hoverLabel != null && (
        <p className="mt-2 text-center text-[11px] text-slate-400">
          {hoverLabel}
        </p>
      )}
    </section>
  );
}
