"use client";

import { useState } from "react";
import type { DashboardEvent } from "@/lib/types";

function sortByDate(a: DashboardEvent, b: DashboardEvent) {
  return a.date.localeCompare(b.date);
}

/**
 * 事件文字集中於圖外，避免 Recharts ReferenceLine label 在圖頂重疊無法閱讀。
 */
export function EventLegend({ events }: { events: DashboardEvent[] }) {
  const market = events.filter((e) => e.type === "market").sort(sortByDate);
  const regime = events
    .filter((e) => e.type === "regime_change")
    .sort(sortByDate);
  const [regimeOpen, setRegimeOpen] = useState(false);

  if (market.length === 0 && regime.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-slate-700/50 pt-3 text-xs">
      <p className="text-[11px] leading-relaxed text-slate-500">
        圖上僅畫<strong className="text-slate-400">虛線</strong>
        標出手動事件位置，文字不再疊在圖上。景氣階段（Regime）請以
        <strong className="text-slate-400">背景色帶</strong>
        為主；若需對照切換日期，請用下方列表。
      </p>

      {market.length > 0 && (
        <div>
          <p className="mb-1.5 font-medium text-slate-300">手動標註事件（對應圖中虛線）</p>
          <ul className="space-y-1.5 rounded-lg border border-slate-700/60 bg-slate-950/40 p-3">
            {market.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <span className="shrink-0 font-mono tabular-nums text-slate-500">
                  {e.date}
                </span>
                <span className="min-w-0 text-slate-200 break-words">{e.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {regime.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setRegimeOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-700/60 bg-slate-950/30 px-3 py-2 text-left text-slate-300 transition hover:bg-slate-900/50"
          >
            <span>
              Regime 切換紀錄（{regime.length} 筆，可捲動）
            </span>
            <span className="text-slate-500" aria-hidden>
              {regimeOpen ? "▼" : "▶"}
            </span>
          </button>
          {regimeOpen && (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-950/40 p-3 text-[11px] leading-snug">
              {regime.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-0.5 border-b border-slate-800/80 py-1.5 last:border-b-0 sm:flex-row sm:gap-3"
                >
                  <span className="shrink-0 font-mono tabular-nums text-slate-500">
                    {e.date}
                  </span>
                  <span className="min-w-0 text-slate-300 break-words">{e.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
