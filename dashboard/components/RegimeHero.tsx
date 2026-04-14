import type { CurrentRecord } from "@/lib/types";
import { regimeColor, regimeLabelZh } from "@/lib/regime";
import type { ScoreDeltas } from "@/lib/score-deltas";
import {
  heroSummary,
  inflationVerdict,
  liquidityVerdict,
  riskVerdict,
  scoreVerdict,
} from "@/lib/interpretation";

function num(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(3);
}

function temp(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

/** Interpolate hex colors for gauge */
function tempColor(t: number): string {
  const x = Math.max(0, Math.min(100, t)) / 100;
  // cold blue -> warm red
  const r = Math.round(56 + (248 - 56) * x);
  const g = Math.round(189 + (113 - 189) * x);
  const b = Math.round(248 + (113 - 248) * x);
  return `rgb(${r},${g},${b})`;
}

const R = 88;
const CX = 120;
const CY = 120;
const ARC_LEN = Math.PI * R;

function TemperatureGauge({ value }: { value: number | null }) {
  const t = value == null || Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
  const offset = ARC_LEN * (1 - t / 100);
  const stroke = tempColor(t);

  return (
    <div className="flex flex-col items-center">
      <svg width={240} height={130} viewBox="0 0 240 130" className="overflow-visible">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="#334155"
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={ARC_LEN}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Needle dot */}
        <circle
          cx={CX + R * Math.cos(Math.PI * (1 - t / 100))}
          cy={CY - R * Math.sin(Math.PI * (1 - t / 100))}
          r={5}
          fill={stroke}
          stroke="#0f172a"
          strokeWidth={2}
        />
      </svg>
      <p className="-mt-1 text-center text-3xl font-semibold tabular-nums text-white">
        {temp(value as unknown)}
        <span className="ml-1 text-lg font-normal text-slate-500">/100</span>
      </p>
      <p className="text-xs text-slate-500">宏觀溫度</p>
    </div>
  );
}

function ScoreBar({
  labelZh,
  labelEn,
  valueStr,
  value,
  delta,
  accent,
  markerClass,
  verdictLabel,
  verdictClass,
}: {
  labelZh: string;
  labelEn: string;
  valueStr: string;
  value: number | null;
  delta: number | null;
  accent: string;
  markerClass: string;
  verdictLabel: string;
  verdictClass: string;
}) {
  const v = value == null || Number.isNaN(value) ? 0 : Math.max(-1, Math.min(1, value));
  const pct = ((v + 1) / 2) * 100;
  const deltaStr =
    delta == null || Number.isNaN(delta)
      ? null
      : `${delta >= 0 ? "+" : ""}${delta.toFixed(3)}`;

  return (
    <div className="rounded-lg bg-slate-900/80 px-3 py-2 ring-1 ring-slate-700/60">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-200">{labelZh}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{labelEn}</p>
        </div>
        <span
          className={`rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium ring-1 ring-slate-600/60 ${verdictClass}`}
        >
          {verdictLabel}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <p className={`font-mono text-sm font-semibold tabular-nums ${accent}`}>{valueStr}</p>
        {deltaStr != null && (
          <span
            className={`text-[10px] font-mono tabular-nums ${
              deltaStr.startsWith("+") ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {deltaStr.startsWith("+") ? "↑" : "↓"} {deltaStr} 4W
          </span>
        )}
      </div>
      <div
        className="relative mt-1.5 h-2 w-full rounded-full bg-gradient-to-r from-rose-600/40 via-slate-600/50 to-emerald-500/40"
        title={`${labelZh}: ${valueStr}`}
      >
        <div
          className={`absolute top-0 h-2 w-1.5 -translate-x-1/2 rounded-sm shadow ${markerClass}`}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function RegimeHero({
  current,
  deltas,
}: {
  current: CurrentRecord;
  deltas: ScoreDeltas;
}) {
  const regime = String(current.regime ?? "neutral");
  const bg = regimeColor(regime);
  const labelZh = regimeLabelZh(regime);
  const mt = current.macro_temperature;
  const tempNum =
    mt == null ? null : typeof mt === "number" ? mt : Number(mt);

  const gScore = current.growth_score == null ? null : Number(current.growth_score);
  const infScore = current.inflation_score == null ? null : Number(current.inflation_score);
  const liqScore = current.liquidity_score == null ? null : Number(current.liquidity_score);
  const rkScore = current.risk_score == null ? null : Number(current.risk_score);

  const summary = heroSummary(tempNum, gScore, infScore, liqScore, rkScore, labelZh);

  const gVerdict = scoreVerdict(gScore);
  const infVerdict = inflationVerdict(infScore);
  const liqVerdict = liquidityVerdict(liqScore);
  const rkVerdict = riskVerdict(rkScore);

  return (
    <section
      className="rounded-2xl border border-slate-700/80 shadow-xl overflow-hidden"
      style={{ borderColor: `${bg}55` }}
    >
      {/* 頂部摘要橫幅 */}
      <div
        className="px-6 py-4 border-b border-slate-700/60"
        style={{
          background: `linear-gradient(135deg, ${summary.zoneBgHex}55 0%, ${bg}22 60%, rgb(15 23 42) 100%)`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
              市場天氣摘要 · 截至 {String(current.week)}
            </p>
            <p className="text-base font-semibold text-white leading-snug">
              {summary.headline}
            </p>
            {summary.detail && (
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                {summary.detail}
              </p>
            )}
          </div>
          <div
            className="shrink-0 rounded-xl px-3 py-1.5 text-sm font-bold text-white"
            style={{ background: summary.zoneBgHex }}
          >
            {summary.zoneShortLabel}
          </div>
        </div>
      </div>

      {/* 主體 */}
      <div
        className="p-6"
        style={{
          background: `linear-gradient(135deg, ${bg}12 0%, rgb(15 23 42) 50%)`,
        }}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px_minmax(0,1.2fr)] lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
              宏觀 Regime
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <h2 className="text-3xl font-bold text-white md:text-4xl">{labelZh}</h2>
              <span className="rounded-md bg-slate-800/80 px-2 py-0.5 font-mono text-sm text-slate-300">
                {regime}
              </span>
            </div>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-slate-400">
              溫度整合成長、通膨、流動性與風險偏好四個維度，映射至 0–100 分；
              右側分數條顯示各維度強弱與近 4 週變化方向。
            </p>
          </div>

          <TemperatureGauge value={tempNum} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ScoreBar
              labelZh="成長"
              labelEn="Growth"
              valueStr={num(current.growth_score)}
              value={gScore}
              delta={deltas.growth_score}
              accent="text-emerald-400"
              markerClass="bg-emerald-400"
              verdictLabel={gVerdict.label}
              verdictClass={gVerdict.textClass}
            />
            <ScoreBar
              labelZh="通膨"
              labelEn="Inflation"
              valueStr={num(current.inflation_score)}
              value={infScore}
              delta={deltas.inflation_score}
              accent="text-orange-400"
              markerClass="bg-orange-400"
              verdictLabel={infVerdict.label}
              verdictClass={infVerdict.textClass}
            />
            <ScoreBar
              labelZh="流動性"
              labelEn="Liquidity"
              valueStr={num(current.liquidity_score)}
              value={liqScore}
              delta={deltas.liquidity_score}
              accent="text-sky-400"
              markerClass="bg-sky-400"
              verdictLabel={liqVerdict.label}
              verdictClass={liqVerdict.textClass}
            />
            <ScoreBar
              labelZh="風險偏好"
              labelEn="Risk"
              valueStr={num(current.risk_score)}
              value={rkScore}
              delta={deltas.risk_score}
              accent="text-violet-400"
              markerClass="bg-violet-400"
              verdictLabel={rkVerdict.label}
              verdictClass={rkVerdict.textClass}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
