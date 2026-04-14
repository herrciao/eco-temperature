import type { CurrentRecord } from "@/lib/types";
import { regimeColor, regimeLabelZh } from "@/lib/regime";

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

export function RegimeCard({ current }: { current: CurrentRecord }) {
  const regime = String(current.regime ?? "neutral");
  const bg = regimeColor(regime);
  const labelZh = regimeLabelZh(regime);

  return (
    <section
      className="rounded-2xl border border-slate-700/80 p-6 shadow-xl"
      style={{
        background: `linear-gradient(135deg, ${bg}33 0%, rgb(15 23 42) 55%)`,
        borderColor: `${bg}66`,
      }}
    >
      <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
        宏觀 Regime（截至 {String(current.week)})
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h2 className="text-3xl font-bold text-white md:text-4xl">{labelZh}</h2>
        <span className="rounded-md bg-slate-800/80 px-2 py-0.5 font-mono text-sm text-slate-300">
          {regime}
        </span>
      </div>
      <p className="mt-4 text-5xl font-semibold tabular-nums text-white md:text-6xl">
        {temp(current.macro_temperature)}
        <span className="ml-1 text-2xl font-normal text-slate-400">/100</span>
      </p>
      <p className="mt-1 text-sm text-slate-400">宏觀溫度 Macro temperature</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ScorePill label="Growth" value={num(current.growth_score)} color="text-emerald-400" />
        <ScorePill label="Inflation" value={num(current.inflation_score)} color="text-orange-400" />
        <ScorePill label="Liquidity" value={num(current.liquidity_score)} color="text-sky-400" />
        <ScorePill label="Risk" value={num(current.risk_score)} color="text-violet-400" />
      </div>
    </section>
  );
}

function ScorePill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-slate-900/80 px-3 py-2 ring-1 ring-slate-700/60">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-mono text-sm font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
