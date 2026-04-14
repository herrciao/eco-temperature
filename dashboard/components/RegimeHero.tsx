import type { CurrentRecord } from "@/lib/types";
import { regimeColor, regimeLabelZh } from "@/lib/regime";
import type { ScoreDeltas } from "@/lib/score-deltas";

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
  label,
  valueStr,
  value,
  delta,
  accent,
  markerClass,
}: {
  label: string;
  valueStr: string;
  value: number | null;
  delta: number | null;
  accent: string;
  markerClass: string;
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
        <p className="text-xs text-slate-500">{label}</p>
        {deltaStr != null && (
          <span
            className={`text-[10px] font-mono tabular-nums ${
              deltaStr.startsWith("+") ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            4W {deltaStr}
          </span>
        )}
      </div>
      <p className={`font-mono text-sm font-semibold tabular-nums ${accent}`}>{valueStr}</p>
      <div
        className="relative mt-1 h-2 w-full rounded-full bg-gradient-to-r from-rose-600/40 via-slate-600/50 to-emerald-500/40"
        title={`${label}: ${valueStr}`}
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

  return (
    <section
      className="rounded-2xl border border-slate-700/80 p-6 shadow-xl"
      style={{
        background: `linear-gradient(135deg, ${bg}22 0%, rgb(15 23 42) 50%)`,
        borderColor: `${bg}55`,
      }}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px_minmax(0,1.2fr)] lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
            宏觀 Regime（截至 {String(current.week)}）
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <h2 className="text-3xl font-bold text-white md:text-4xl">{labelZh}</h2>
            <span className="rounded-md bg-slate-800/80 px-2 py-0.5 font-mono text-sm text-slate-300">
              {regime}
            </span>
          </div>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-slate-400">
            溫度整合成長、通膨、流動性與風險偏好；分數條顯示各維度多空與近 4 週變化。上方
            Regime 名稱為規則式分類（門檻見後端{" "}
            <span className="font-mono text-slate-500">config.RegimeThresholds</span>
            ），與單一因子的配方權重不同維度；因子權重請見下方「因子拆解」。
          </p>
        </div>

        <TemperatureGauge value={tempNum} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ScoreBar
            label="Growth"
            valueStr={num(current.growth_score)}
            value={
              current.growth_score == null
                ? null
                : Number(current.growth_score)
            }
            delta={deltas.growth_score}
            accent="text-emerald-400"
            markerClass="bg-emerald-400"
          />
          <ScoreBar
            label="Inflation"
            valueStr={num(current.inflation_score)}
            value={
              current.inflation_score == null
                ? null
                : Number(current.inflation_score)
            }
            delta={deltas.inflation_score}
            accent="text-orange-400"
            markerClass="bg-orange-400"
          />
          <ScoreBar
            label="Liquidity"
            valueStr={num(current.liquidity_score)}
            value={
              current.liquidity_score == null
                ? null
                : Number(current.liquidity_score)
            }
            delta={deltas.liquidity_score}
            accent="text-sky-400"
            markerClass="bg-sky-400"
          />
          <ScoreBar
            label="Risk"
            valueStr={num(current.risk_score)}
            value={
              current.risk_score == null ? null : Number(current.risk_score)
            }
            delta={deltas.risk_score}
            accent="text-violet-400"
            markerClass="bg-violet-400"
          />
        </div>
      </div>
    </section>
  );
}
