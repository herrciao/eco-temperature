"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardEvent, PanelRow } from "@/lib/types";
import { REGIME_COLORS, regimeLabelZh } from "@/lib/regime";
import { EventMarkers } from "@/components/EventMarkers";
import {
  findSimilarWeeksBy4D,
  forwardSpyReturnPct,
  fourDimensionNarrative,
  inflationVerdict,
  liquidityVerdict,
  riskVerdict,
  scoreVerdict,
} from "@/lib/interpretation";
import { nearestMarketEventLabel } from "@/lib/events";

const SERIES = [
  { key: "growth_score", name: "Growth", color: "#34d399", zh: "成長" },
  { key: "inflation_score", name: "Inflation", color: "#fb923c", zh: "通膨" },
  { key: "liquidity_score", name: "Liquidity", color: "#38bdf8", zh: "流動性" },
  { key: "risk_score", name: "Risk", color: "#a78bfa", zh: "風險偏好" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

function mergeRegimeSegments(
  panel: PanelRow[]
): { x1: string; x2: string; regime: string }[] {
  if (panel.length === 0) return [];
  const out: { x1: string; x2: string; regime: string }[] = [];
  let segStart = panel[0].week;
  let segRegime = panel[0].regime;
  for (let i = 1; i < panel.length; i++) {
    if (panel[i].regime !== segRegime) {
      out.push({ x1: segStart, x2: panel[i - 1].week, regime: segRegime });
      segStart = panel[i].week;
      segRegime = panel[i].regime;
    }
  }
  out.push({
    x1: segStart,
    x2: panel[panel.length - 1].week,
    regime: segRegime,
  });
  return out;
}

export function ScoresChart({
  panel,
  fullPanel,
  events,
}: {
  panel: PanelRow[];
  /** Full sample for「歷史類似」類比（預設等於 panel） */
  fullPanel?: PanelRow[];
  events: DashboardEvent[];
}) {
  const history = fullPanel ?? panel;
  // null = 全選（未做任何過濾）；Set 內的 key = 目前顯示中的線
  const [visible, setVisible] = useState<Set<SeriesKey> | null>(null);

  function toggleSeries(key: SeriesKey) {
    setVisible((cur) => {
      // 從「全選」狀態開始，先展開成完整 Set 再 toggle
      const base: Set<SeriesKey> =
        cur == null ? new Set(SERIES.map((s) => s.key)) : new Set(cur);
      if (base.has(key)) {
        base.delete(key);
        // 若全部取消 → 回到全選
        if (base.size === 0) return null;
      } else {
        base.add(key);
        // 若已全選 → 回到全選（null）
        if (base.size === SERIES.length) return null;
      }
      return base;
    });
  }

  function isVisible(key: SeriesKey): boolean {
    return visible == null || visible.has(key);
  }

  const data = panel.map((p) => ({
    week: p.week,
    regime: p.regime,
    growth_score: p.growth_score == null ? null : Number(p.growth_score),
    inflation_score:
      p.inflation_score == null ? null : Number(p.inflation_score),
    liquidity_score:
      p.liquidity_score == null ? null : Number(p.liquidity_score),
    risk_score: p.risk_score == null ? null : Number(p.risk_score),
  }));
  const segments = mergeRegimeSegments(panel);
  const x0 = panel[0]?.week;
  const x1 = panel[panel.length - 1]?.week;

  const lastRow = panel[panel.length - 1];
  const narrative = useMemo(() => {
    if (!lastRow) return { main: "", similar: "" as string | null };
    const g = lastRow.growth_score == null ? null : Number(lastRow.growth_score);
    const inf =
      lastRow.inflation_score == null ? null : Number(lastRow.inflation_score);
    const liq =
      lastRow.liquidity_score == null ? null : Number(lastRow.liquidity_score);
    const rk = lastRow.risk_score == null ? null : Number(lastRow.risk_score);
    const main = fourDimensionNarrative(g, inf, liq, rk);

    const similar = findSimilarWeeksBy4D(history, lastRow, 3);
    if (similar.length === 0) {
      return { main, similar: null as string | null };
    }
    const idxMap = new Map(history.map((r, i) => [r.week, i]));
    const bits = similar.map((s) => {
      const i = idxMap.get(s.week);
      if (i == null) return `${s.week.slice(0, 7)} (距離 ${s.distance.toFixed(2)})`;
      const r26 = forwardSpyReturnPct(history, i, 26);
      const note = nearestMarketEventLabel(s.week);
      const ret =
        r26 != null
          ? `；其後約 26 週 SPY 累積報酬約 ${r26 >= 0 ? "+" : ""}${r26.toFixed(1)}%`
          : "";
      return `${s.week.slice(0, 7)}${note ? `（${note}）` : ""}（4D 距離 ${s.distance.toFixed(2)}${ret}）`;
    });
    const similarText = `歷史類似週期（僅供對照，不保證重演）：${bits.join("；")}。可對照下方 SPY 週線圖檢視該時點後續走勢。`;
    return { main, similar: similarText };
  }, [history, lastRow]);

  const snapshot = useMemo(() => {
    if (!lastRow) return null;
    const g = lastRow.growth_score == null ? null : Number(lastRow.growth_score);
    const inf =
      lastRow.inflation_score == null ? null : Number(lastRow.inflation_score);
    const liq =
      lastRow.liquidity_score == null ? null : Number(lastRow.liquidity_score);
    const rk = lastRow.risk_score == null ? null : Number(lastRow.risk_score);
    return [
      { label: "成長", v: g, verdict: scoreVerdict(g) },
      { label: "通膨壓力", v: inf, verdict: inflationVerdict(inf) },
      { label: "流動性", v: liq, verdict: liquidityVerdict(liq) },
      { label: "風險偏好", v: rk, verdict: riskVerdict(rk) },
    ];
  }, [lastRow]);

  return (
    <section className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4">
      <h3 className="mb-2 text-lg font-semibold text-slate-100">
        四維合成得分（週）+ Regime 背景 + 事件線
      </h3>
      <p className="mb-2 text-xs text-slate-500">
        Y 軸 -1～+1；四條線為合成得分；背景色為 Regime；虛線為手動事件。事件與 Regime
        切換文字請見上方「SPY 週線」下方；各維度如何加權見「因子拆解」。
      </p>

      {snapshot && (
        <div className="mb-3 rounded-xl border border-slate-700/80 bg-slate-950/50 p-3">
          <p className="text-[11px] font-medium text-slate-300">目前四維快照（最新週）</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {snapshot.map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap items-baseline justify-between gap-1 rounded-lg bg-slate-900/80 px-2 py-1.5 ring-1 ring-slate-800"
              >
                <span className="text-[11px] text-slate-500">{row.label}</span>
                <span className={`text-[11px] font-medium ${row.verdict.textClass}`}>
                  {row.verdict.label}
                </span>
                <span className="w-full font-mono text-xs text-slate-200">
                  {row.v == null || Number.isNaN(row.v) ? "—" : row.v.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">{narrative.main}</p>
          {narrative.similar && (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {narrative.similar}
            </p>
          )}
        </div>
      )}

      {/* 多選 toggle 區 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-lg border px-2.5 py-1 text-[10px] transition-colors ${
            visible == null
              ? "border-slate-400 bg-slate-700/60 text-slate-100"
              : "border-slate-600 bg-slate-900 text-slate-500"
          }`}
          onClick={() => setVisible(null)}
        >
          全選
        </button>
        {SERIES.map((s) => {
          const on = isVisible(s.key);
          return (
            <button
              key={s.key}
              type="button"
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] transition-colors ${
                on
                  ? "text-white"
                  : "border-slate-700 bg-slate-900/60 text-slate-600"
              }`}
              style={
                on
                  ? { borderColor: s.color, backgroundColor: `${s.color}18` }
                  : undefined
              }
              onClick={() => toggleSeries(s.key)}
            >
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: on ? s.color : "#475569" }}
              />
              {s.zh}
            </button>
          );
        })}
      </div>

      <div className="h-[380px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="week"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(v) => (typeof v === "string" ? v.slice(0, 7) : v)}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={[-1, 1]}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickCount={9}
            />
            {segments.map((seg, i) => (
              <ReferenceArea
                key={`${seg.x1}-${seg.x2}-${seg.regime}-sc-${i}`}
                x1={seg.x1}
                x2={seg.x2}
                strokeOpacity={0}
                fill={REGIME_COLORS[seg.regime] ?? "#64748b"}
                fillOpacity={0.16}
              />
            ))}
            {x0 && x1 && (
              <>
                <ReferenceArea
                  x1={x0}
                  x2={x1}
                  y1={-1}
                  y2={0}
                  fill="#f43f5e"
                  fillOpacity={0.07}
                  strokeOpacity={0}
                />
                <ReferenceArea
                  x1={x0}
                  x2={x1}
                  y1={0}
                  y2={1}
                  fill="#34d399"
                  fillOpacity={0.07}
                  strokeOpacity={0}
                />
              </>
            )}
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as {
                  regime: string;
                  growth_score: number | null;
                  inflation_score: number | null;
                  liquidity_score: number | null;
                  risk_score: number | null;
                };
                const g = row.growth_score;
                const inf = row.inflation_score;
                const liq = row.liquidity_score;
                const rk = row.risk_score;
                const blurb = fourDimensionNarrative(g, inf, liq, rk);
                return (
                  <div className="max-w-sm rounded-lg border border-slate-600 bg-slate-900/95 p-3 text-xs shadow-xl">
                    <p className="font-medium text-slate-200">週 {label}</p>
                    <p className="mt-1 text-slate-400">
                      {regimeLabelZh(String(row.regime))}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      {blurb}
                    </p>
                    {SERIES.map((s) => {
                      const v = row[s.key as keyof typeof row];
                      const n =
                        typeof v === "number" ? v : v == null ? null : Number(v);
                      const dim = isVisible(s.key) ? "opacity-100" : "opacity-30";
                      return (
                        <p
                          key={s.key}
                          className={`mt-0.5 font-mono tabular-nums ${dim}`}
                          style={{ color: s.color }}
                        >
                          {s.name}{" "}
                          {n == null || Number.isNaN(n) ? "—" : n.toFixed(3)}
                        </p>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => (
                <span className="text-slate-300">{String(value)}</span>
              )}
            />
            {SERIES.map((s) => {
              const on = isVisible(s.key);
              return (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={on ? 1.8 : 0.8}
                  strokeOpacity={on ? 1 : 0.15}
                  dot={false}
                  connectNulls
                />
              );
            })}
            <EventMarkers events={events} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
        <summary className="cursor-pointer select-none text-slate-300 hover:text-slate-200">
          怎麼用這張圖（點開）
        </summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-relaxed">
          <li>
            <strong className="text-slate-300">看交叉</strong>：成長由下往上穿越 0、且流動性也在 0
            以上時，常見於環境好轉的早期組合（仍非保證）。
          </li>
          <li>
            <strong className="text-slate-300">看分歧</strong>：成長高但通膨也高 → 過熱徵兆；成長低而通膨高 →
            滯脹風險較高。
          </li>
          <li>
            <strong className="text-slate-300">看趨勢</strong>：四條線同向 → 宏觀動能一致；若方向分歧，宜降低單一解讀。
          </li>
          <li>
            <strong className="text-slate-300">搭配 Regime</strong>：背景色為規則式分類，可對照四條線是否同向支持該標籤。
          </li>
          <li>
            0 線下方略紅、上方略綠，僅提示正負方向；數值仍請以左側因子拆解為準。
          </li>
        </ul>
      </details>
    </section>
  );
}
