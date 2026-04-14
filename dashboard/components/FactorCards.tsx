import type { ReactNode } from "react";
import type { CurrentRecord } from "@/lib/types";
import {
  GROWTH_COMPONENTS,
  INFLATION_COMPONENTS,
  LIQUIDITY_COMPONENTS,
  RISK_DRIVERS,
  RISK_WEIGHT_SUM,
  RISK_FORMULA_PARAGRAPHS,
  componentValue,
  fieldHintsForKeys,
  formatCompositionSentence,
  riskDriverBarPct,
  riskDriverValue,
  zCompositeNarrativeParagraphs,
  zToBarPct,
  type FactorComponentDef,
} from "@/lib/factors";
import type { ScoreDeltas } from "@/lib/score-deltas";

function fmt3(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(3);
}

function ZBar({
  label,
  weight,
  z,
  color,
}: {
  label: string;
  weight: number;
  z: number | null;
  color: string;
}) {
  const pct = z == null || Number.isNaN(z) ? 50 : zToBarPct(z);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-slate-500">
        <span className="truncate pr-1" title={label}>
          {label}
        </span>
        <span className="shrink-0 font-mono text-slate-400">
          {(weight * 100).toFixed(0)}%
        </span>
      </div>
      <div className="relative h-2 w-full rounded bg-slate-800">
        <div
          className="absolute inset-y-0 w-px bg-slate-500"
          style={{ left: "50%" }}
        />
        <div
          className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-sm shadow"
          style={{ left: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="font-mono text-[10px] text-slate-500">{fmt3(z)} z</p>
    </div>
  );
}

function WeightStackBar({ components }: { components: FactorComponentDef[] }) {
  return (
    <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-lg bg-slate-800 ring-1 ring-slate-700/80">
      {components.map((c) => (
        <div
          key={c.key}
          title={`${c.label} ${(c.weight * 100).toFixed(0)}%`}
          className="h-full min-w-[3px] transition-opacity hover:opacity-90"
          style={{ width: `${c.weight * 100}%`, backgroundColor: c.color }}
        />
      ))}
    </div>
  );
}

function RiskWeightStackBar() {
  return (
    <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-lg bg-slate-800 ring-1 ring-slate-700/80">
      {RISK_DRIVERS.map((row) => (
        <div
          key={row.key}
          title={`${row.label} ${((row.weight / RISK_WEIGHT_SUM) * 100).toFixed(0)}%`}
          className="h-full min-w-[3px] transition-opacity hover:opacity-90"
          style={{
            width: `${(row.weight / RISK_WEIGHT_SUM) * 100}%`,
            backgroundColor: row.color,
          }}
        />
      ))}
    </div>
  );
}

function RiskBar({
  label,
  weight,
  value,
  color,
}: {
  label: string;
  weight: number;
  value: number | null;
  color: string;
}) {
  const pct =
    value == null || Number.isNaN(value) ? 50 : riskDriverBarPct(value);
  const pctLabel = `${((weight / RISK_WEIGHT_SUM) * 100).toFixed(0)}%`;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-slate-500">
        <span className="truncate pr-1" title={label}>
          {label}
        </span>
        <span className="shrink-0 font-mono text-slate-400">{pctLabel}</span>
      </div>
      <div className="relative h-2 w-full rounded bg-slate-800">
        <div
          className="absolute inset-y-0 w-px bg-slate-500"
          style={{ left: "50%" }}
        />
        <div
          className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-sm shadow"
          style={{ left: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="font-mono text-[10px] text-slate-500">{fmt3(value)}</p>
    </div>
  );
}

function FactorDetails({ keys }: { keys: string[] }) {
  const rows = fieldHintsForKeys(keys);
  if (rows.length === 0) return null;
  return (
    <details className="mt-2 text-[11px] text-slate-500">
      <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-300">
        欄位代號與意義
      </summary>
      <ul className="mt-2 space-y-1.5 border-t border-slate-800/80 pt-2">
        {rows.map(({ key, hint }) => (
          <li key={key} className="leading-snug">
            <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[10px] text-slate-500">
              {key}
            </code>
            <span className="text-slate-500"> — {hint}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function FactorCard({
  title,
  titleZh,
  scoreKey,
  current,
  delta4w,
  children,
  accentBorder,
  weightStack,
  weightSummaryLine,
  narrativeParagraphs,
  detailKeys,
  footerHint,
}: {
  title: string;
  titleZh: string;
  scoreKey: keyof CurrentRecord;
  current: CurrentRecord;
  delta4w: number | null;
  children: ReactNode;
  accentBorder: string;
  weightStack?: ReactNode;
  /** 權重一句話（與 config.py / 堆疊條一致） */
  weightSummaryLine: string;
  narrativeParagraphs: string[];
  detailKeys: string[];
  footerHint: string;
}) {
  const raw = current[scoreKey];
  const score =
    raw == null ? null : typeof raw === "number" ? raw : Number(raw);
  const d = delta4w;
  const deltaStr =
    d == null || Number.isNaN(d)
      ? null
      : `${d >= 0 ? "+" : ""}${d.toFixed(3)}`;

  return (
    <div
      className={`rounded-2xl border bg-slate-900/50 p-4 ring-1 ring-slate-800 ${accentBorder}`}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{titleZh}</h3>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            {title}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold tabular-nums text-white">
            {fmt3(score)}
          </p>
          {deltaStr != null && (
            <p
              className={`font-mono text-xs ${
                deltaStr.startsWith("+") ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              4W {deltaStr}
            </p>
          )}
        </div>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
        {weightSummaryLine}
      </p>
      {weightStack}
      <div className="space-y-3 border-t border-slate-800/80 pt-3">{children}</div>
      <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
        {narrativeParagraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="text-slate-500">
          僅供研究檢視，不構成投資建議。
        </p>
      </div>
      <FactorDetails keys={detailKeys} />
      <p className="mt-3 text-[10px] leading-snug text-slate-500">{footerHint}</p>
    </div>
  );
}

export function FactorCards({
  current,
  deltas,
}: {
  current: CurrentRecord;
  deltas: ScoreDeltas;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-100">因子拆解</h2>
      <p className="text-sm text-slate-400">
        各分數由下列 z-score（或風險貢獻項）加權後經 tanh 壓縮；長條中央為 0。權重與後端{" "}
        <span className="font-mono text-slate-500">config.py</span> 一致；亦可見{" "}
        <span className="font-mono text-slate-500">output/web/factor_weights.json</span>{" "}
        （執行 <span className="font-mono text-slate-500">python main.py export</span> 後產生）。
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <FactorCard
          title="Growth"
          titleZh="成長"
          scoreKey="growth_score"
          current={current}
          delta4w={deltas.growth_score}
          accentBorder="border-l-4 border-l-emerald-500/80"
          weightSummaryLine={`子項權重（加總 100%）：${formatCompositionSentence(GROWTH_COMPONENTS)}。`}
          weightStack={<WeightStackBar components={GROWTH_COMPONENTS} />}
          narrativeParagraphs={zCompositeNarrativeParagraphs(GROWTH_COMPONENTS)}
          detailKeys={GROWTH_COMPONENTS.map((c) => c.key)}
          footerHint="橫軸為各子項 z-score（約 ±2）；中央為 0。"
        >
          {GROWTH_COMPONENTS.map((c) => (
            <ZBar
              key={c.key}
              label={c.label}
              weight={c.weight}
              z={componentValue(current, c.key)}
              color={c.color}
            />
          ))}
        </FactorCard>

        <FactorCard
          title="Inflation"
          titleZh="通膨壓力"
          scoreKey="inflation_score"
          current={current}
          delta4w={deltas.inflation_score}
          accentBorder="border-l-4 border-l-orange-500/80"
          weightSummaryLine={`子項權重（加總 100%）：${formatCompositionSentence(INFLATION_COMPONENTS)}。`}
          weightStack={<WeightStackBar components={INFLATION_COMPONENTS} />}
          narrativeParagraphs={zCompositeNarrativeParagraphs(INFLATION_COMPONENTS)}
          detailKeys={INFLATION_COMPONENTS.map((c) => c.key)}
          footerHint="橫軸為各子項 z-score（約 ±2）；中央為 0。"
        >
          {INFLATION_COMPONENTS.map((c) => (
            <ZBar
              key={c.key}
              label={c.label}
              weight={c.weight}
              z={componentValue(current, c.key)}
              color={c.color}
            />
          ))}
        </FactorCard>

        <FactorCard
          title="Liquidity"
          titleZh="流動性"
          scoreKey="liquidity_score"
          current={current}
          delta4w={deltas.liquidity_score}
          accentBorder="border-l-4 border-l-sky-500/80"
          weightSummaryLine={`子項權重（加總 100%）：${formatCompositionSentence(LIQUIDITY_COMPONENTS)}。`}
          weightStack={<WeightStackBar components={LIQUIDITY_COMPONENTS} />}
          narrativeParagraphs={zCompositeNarrativeParagraphs(LIQUIDITY_COMPONENTS)}
          detailKeys={LIQUIDITY_COMPONENTS.map((c) => c.key)}
          footerHint="橫軸為各子項 z-score（約 ±2）；中央為 0。"
        >
          {LIQUIDITY_COMPONENTS.map((c) => (
            <ZBar
              key={c.key}
              label={c.label}
              weight={c.weight}
              z={componentValue(current, c.key)}
              color={c.color}
            />
          ))}
        </FactorCard>

        <FactorCard
          title="Risk"
          titleZh="風險偏好"
          scoreKey="risk_score"
          current={current}
          delta4w={deltas.risk_score}
          accentBorder="border-l-4 border-l-violet-500/80"
          weightSummaryLine="線性係數：成長 0.34、通膨取負 0.33、流動性 0.33；另加曲線斜率加成係數 0.1（堆疊條為歸一化相對寬度）。"
          weightStack={<RiskWeightStackBar />}
          narrativeParagraphs={RISK_FORMULA_PARAGRAPHS}
          detailKeys={RISK_DRIVERS.map((r) => r.key)}
          footerHint="橫軸為貢獻項數值（約 ±1）；曲線項先 tanh 再納入加總。"
        >
          {RISK_DRIVERS.map((row) => (
            <RiskBar
              key={row.key}
              label={row.label}
              weight={row.weight}
              value={riskDriverValue(row, current)}
              color={row.color}
            />
          ))}
        </FactorCard>
      </div>
    </section>
  );
}
