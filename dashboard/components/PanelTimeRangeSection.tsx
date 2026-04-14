"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardEvent, PanelRow } from "@/lib/types";
import { filterEventsToVisiblePanel } from "@/lib/events";
import { RegimeTimeline } from "@/components/RegimeTimeline";
import { ScoresChart } from "@/components/ScoresChart";
import { SpyChart } from "@/components/SpyChart";
import { TemperatureChart } from "@/components/TemperatureChart";

/** Default visible span on first load (matches former export window). */
const DEFAULT_VISIBLE_WEEKS = 156;

function defaultBrushRange(len: number): { startIndex: number; endIndex: number } {
  if (len === 0) return { startIndex: 0, endIndex: 0 };
  const span = Math.min(DEFAULT_VISIBLE_WEEKS, len);
  return { startIndex: Math.max(0, len - span), endIndex: len - 1 };
}

/** 原生時間軸：不依賴 Recharts Brush（v3 在部分情況下 Brush 會 render null）。 */
function NativeTimeRangeBar({
  panelLength,
  startIndex,
  endIndex,
  weekAt,
  onChange,
}: {
  panelLength: number;
  startIndex: number;
  endIndex: number;
  weekAt: (i: number) => string;
  onChange: (next: { startIndex: number; endIndex: number }) => void;
}) {
  const last = Math.max(0, panelLength - 1);
  if (panelLength <= 1) {
    return (
      <p className="text-xs text-slate-500">資料不足一週，無法縮放。</p>
    );
  }

  const leftPct = (startIndex / last) * 100;
  const widthPct = ((endIndex - startIndex) / last) * 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-600 bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
          onClick={() =>
            onChange(defaultBrushRange(panelLength))
          }
        >
          最近約 3 年
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-600 bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
          onClick={() => {
            const span = Math.min(260, panelLength);
            onChange({
              startIndex: Math.max(0, panelLength - span),
              endIndex: panelLength - 1,
            });
          }}
        >
          最近約 5 年
        </button>
        <button
          type="button"
          className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-1 text-[11px] text-emerald-100 hover:bg-emerald-900/50"
          onClick={() =>
            onChange({ startIndex: 0, endIndex: panelLength - 1 })
          }
        >
          全期間
        </button>
      </div>

      <div
        className="relative h-4 w-full overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-600/60"
        title={`${weekAt(startIndex)}～${weekAt(endIndex)}`}
      >
        <div
          className="absolute inset-y-0 rounded-full bg-emerald-600/70"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      </div>

      <div className="space-y-2">
        <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <span className="w-28 shrink-0 text-[11px] text-slate-500">
            起（左端）· {weekAt(startIndex)}
          </span>
          <input
            type="range"
            className="h-2 w-full min-w-0 cursor-pointer accent-emerald-500"
            min={0}
            max={last}
            value={startIndex}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({
                startIndex: Math.min(v, endIndex),
                endIndex,
              });
            }}
          />
        </label>
        <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <span className="w-28 shrink-0 text-[11px] text-slate-500">
            迄（右端）· {weekAt(endIndex)}
          </span>
          <input
            type="range"
            className="h-2 w-full min-w-0 cursor-pointer accent-emerald-500"
            min={0}
            max={last}
            value={endIndex}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({
                startIndex,
                endIndex: Math.max(v, startIndex),
              });
            }}
          />
        </label>
      </div>
    </div>
  );
}

export function PanelTimeRangeSection({
  panel,
  events,
}: {
  panel: PanelRow[];
  events: DashboardEvent[];
}) {
  const initialRange = useMemo(
    () => defaultBrushRange(panel.length),
    [panel.length]
  );

  const [brushRange, setBrushRange] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);

  useEffect(() => {
    setBrushRange(null);
  }, [panel.length]);

  const { startIndex, endIndex } = brushRange ?? initialRange;

  const visiblePanel = useMemo(
    () => panel.slice(startIndex, endIndex + 1),
    [panel, startIndex, endIndex]
  );

  const visibleEvents = useMemo(
    () => filterEventsToVisiblePanel(events, visiblePanel),
    [events, visiblePanel]
  );

  const handleNativeRange = (e: { startIndex: number; endIndex: number }) => {
    if (panel.length === 0) return;
    const s = Math.max(0, Math.min(e.startIndex, panel.length - 1));
    const t = Math.max(0, Math.min(e.endIndex, panel.length - 1));
    setBrushRange({ startIndex: Math.min(s, t), endIndex: Math.max(s, t) });
  };

  const weekAtIndex = (i: number) =>
    panel[Math.min(Math.max(0, i), Math.max(0, panel.length - 1))]?.week ?? "—";

  const fullStart = panel[0]?.week;
  const fullEnd = panel[panel.length - 1]?.week;
  const visibleStart = visiblePanel[0]?.week;
  const visibleEnd = visiblePanel[visiblePanel.length - 1]?.week;

  return (
    <div className="space-y-10">
      <section className="sticky top-0 z-30 mb-2 rounded-2xl border border-emerald-900/50 bg-slate-950/90 p-4 shadow-lg shadow-slate-950/50 ring-1 ring-emerald-800/30 backdrop-blur-md">
        <h3 className="text-sm font-medium text-emerald-100/95">
          時間範圍（全歷史縮放）
        </h3>
        {panel.length > 0 && (
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            已載入共 {panel.length} 週 · {fullStart}～{fullEnd}
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          預設圖表為<strong className="text-slate-300">最近約 3 年</strong>
          。請用<strong className="text-slate-200">下方滑桿或快捷按鈕</strong>
          調整起訖週，所有圖表與 Regime 軸會同步；捲動頁面時本區塊會留在畫面上方。
        </p>
        {visibleStart && visibleEnd && (
          <p className="mt-1.5 text-[11px] text-slate-500">
            目前圖上區間：{visibleStart}～{visibleEnd}（
            {visiblePanel.length} 週）
          </p>
        )}
        <div className="mt-4">
          <NativeTimeRangeBar
            panelLength={panel.length}
            startIndex={startIndex}
            endIndex={endIndex}
            weekAt={weekAtIndex}
            onChange={handleNativeRange}
          />
        </div>
      </section>

      <TemperatureChart
        panel={visiblePanel}
        fullPanel={panel}
        events={visibleEvents}
      />

      <RegimeTimeline panel={visiblePanel} />

      <SpyChart panel={visiblePanel} events={visibleEvents} />

      <ScoresChart
        panel={visiblePanel}
        fullPanel={panel}
        events={visibleEvents}
      />
    </div>
  );
}
