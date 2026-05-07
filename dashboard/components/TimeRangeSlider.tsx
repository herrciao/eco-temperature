"use client";

import { useCallback, useEffect, useRef } from "react";

interface Props {
  totalWeeks: number;
  weeks: string[];
  rangeStart: number;
  rangeEnd: number;
  onChange: (start: number, end: number) => void;
}

const PRESETS = [
  { label: "最近 3 年", years: 3 },
  { label: "最近 5 年", years: 5 },
  { label: "全期間", years: 0 },
];

function yearsToIndex(totalWeeks: number, years: number): number {
  if (years === 0) return 0;
  return Math.max(0, totalWeeks - 1 - Math.round(years * 52.18));
}

function detectPreset(totalWeeks: number, start: number, end: number): number | null {
  if (end !== totalWeeks - 1) return null;
  for (const p of PRESETS) {
    if (yearsToIndex(totalWeeks, p.years) === start) return p.years;
  }
  return null;
}

export function TimeRangeSlider({ totalWeeks, weeks, rangeStart, rangeEnd, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const applyPreset = useCallback(
    (years: number) => {
      const start = yearsToIndex(totalWeeks, years);
      const end = totalWeeks - 1;
      onChange(start, end);
    },
    [totalWeeks, onChange]
  );

  // Default to "最近 3 年" on mount
  useEffect(() => {
    applyPreset(3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pL = totalWeeks > 1 ? (rangeStart / (totalWeeks - 1)) * 100 : 0;
  const pR = totalWeeks > 1 ? (rangeEnd / (totalWeeks - 1)) * 100 : 100;
  const activePreset = detectPreset(totalWeeks, rangeStart, rangeEnd);
  const displayedWeeks = rangeEnd - rangeStart + 1;

  return (
    <div className="sticky top-0 z-30 rounded-xl border border-slate-700/60 bg-slate-950/95 backdrop-blur px-4 py-3 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <span className="text-sm font-semibold text-slate-200">時間範圍</span>
          <span className="ml-2 text-xs text-slate-500">
            {weeks[rangeStart] ?? "—"} ～ {weeks[rangeEnd] ?? "—"}（{displayedWeeks} 週）
          </span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.years}
              onClick={() => applyPreset(p.years)}
              className={`px-2.5 py-0.5 rounded text-xs border transition-colors ${
                activePreset === p.years
                  ? "bg-sky-500/20 border-sky-500 text-sky-300 font-semibold"
                  : "border-slate-700 text-slate-400 hover:border-sky-500/60 hover:text-sky-300 bg-transparent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dual range track */}
      <div ref={trackRef} className="relative h-8 select-none">
        {/* Background track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full bg-slate-800" />
        {/* Filled track */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-sky-500/50"
          style={{ left: `${pL}%`, width: `${pR - pL}%` }}
        />

        {/* Left handle */}
        <input
          type="range"
          min={0}
          max={totalWeeks - 1}
          value={rangeStart}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), rangeEnd - 1);
            onChange(v, rangeEnd);
          }}
          className="range-handle"
        />

        {/* Right handle */}
        <input
          type="range"
          min={0}
          max={totalWeeks - 1}
          value={rangeEnd}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), rangeStart + 1);
            onChange(rangeStart, v);
          }}
          className="range-handle"
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[11px] text-slate-600 mt-0.5">
        <span>{weeks[0] ?? "—"}</span>
        <span>{weeks[totalWeeks - 1] ?? "—"}</span>
      </div>
    </div>
  );
}
