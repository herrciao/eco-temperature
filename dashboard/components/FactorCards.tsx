import type { ReactNode } from "react";
import type { CurrentRecord, PanelRow } from "@/lib/types";
import {
  delta4wNarrative,
  factorNarrative,
  findSimilarHistoricalWeek,
  inflationVerdict,
  liquidityVerdict,
  panelScoreSeries,
  percentileRank,
  riskVerdict,
  scoreVerdict,
  type ScoreKey,
} from "@/lib/interpretation";
import { nearestMarketEventLabel } from "@/lib/events";
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

function verdictForFactor(
  kind: "growth" | "inflation" | "liquidity" | "risk",
  score: number | null
) {
  if (kind === "inflation") return inflationVerdict(score);
  if (kind === "liquidity") return liquidityVerdict(score);
  if (kind === "risk") return riskVerdict(score);
  return scoreVerdict(score);
}

function FactorCard({
  title,
  titleZh,
  scoreKey,
  factorKind,
  current,
  delta4w,
  panel,
  children,
  accentBorder,
  weightStack,
  weightSummaryLine,
  narrativeParagraphs,
  detailKeys,
  footerHint,
  topComponents,
}: {
  title: string;
  titleZh: string;
  scoreKey: keyof CurrentRecord;
  factorKind: "growth" | "inflation" | "liquidity" | "risk";
  current: CurrentRecord;
  delta4w: number | null;
  children: ReactNode;
  accentBorder: string;
  weightStack?: ReactNode;
  weightSummaryLine: string;
  narrativeParagraphs: string[];
  detailKeys: string[];
  footerHint: string;
  panel: PanelRow[];
  topComponents: { label: string; z: number | null }[];
}) {
  const raw = current[scoreKey];
  const score =
    raw == null ? null : typeof raw === "number" ? raw : Number(raw);
  const d = delta4w;
  const deltaStr =
    d == null || Number.isNaN(d)
      ? null
      : `${d >= 0 ? "+" : ""}${d.toFixed(3)}`;

  const sk = scoreKey as ScoreKey;
  const hist = panelScoreSeries(panel, sk);
  const pct =
    score != null && !Number.isNaN(score) && hist.length > 0
      ? percentileRank(score, hist)
      : null;

  const verdict = verdictForFactor(factorKind, score);
  const deltaPhrase = delta4wNarrative(d);
  const narrative = factorNarrative(factorKind, score, topComponents);

  const similar =
    score != null && !Number.isNaN(score)
      ? findSimilarHistoricalWeek(panel, sk, score)
      : null;
  const eventNote = similar ? nearestMarketEventLabel(similar.week) : null;
  const anchorLine =
    similar != null
      ? `歷史錨點：${similar.week.slice(0, 7)} 附近數值接近（±約 ${similar.distance.toFixed(2)}）${eventNote ? ` — ${eventNote}` : ""}`
      : null;

  return (
    <div
      className={`rounded-2xl border bg-slate-900/50 p-4 ring-1 ring-slate-800 ${accentBorder}`}
    >
      {/* 卡片頂部：標題、verdict、分數、白話解讀 */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-200">{titleZh}</h3>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${verdict.textClass} bg-slate-800/90 ring-1 ring-slate-600/60`}
            >
              {verdict.label}
            </span>
          </div>
          {/* 白話解讀 — 預設可見 */}
          <p className="text-sm font-medium text-slate-200 leading-snug">
            {narrative.oneLiner}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            {narrative.detail}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-2xl font-semibold tabular-nums text-white">
            {fmt3(score)}
          </p>
          {deltaStr != null && (
            <p
              className={`font-mono text-xs ${
                deltaStr.startsWith("+") ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {deltaStr.startsWith("+") ? "↑" : "↓"} {deltaStr}
              {deltaPhrase ? (
                <span className="ml-1 font-sans text-[10px] text-slate-500">
                  · {deltaPhrase}
                </span>
              ) : null}
            </p>
          )}
          {pct != null && (
            <p className="mt-1 text-[10px] text-slate-500">
              歷史 {pct.toFixed(0)}th 百分位
            </p>
          )}
        </div>
      </div>

      {/* 權重堆疊條 — 視覺直覺，保留 */}
      {weightStack}

      {/* 模型細節：預設收合 */}
      <details className="mt-3 group">
        <summary className="cursor-pointer select-none text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 list-none">
          <span className="inline-block transition-transform group-open:rotate-90">▶</span>
          模型細節
        </summary>
        <div className="mt-3 space-y-4 border-t border-slate-800/80 pt-3">
          <p className="text-[11px] leading-relaxed text-slate-500">{weightSummaryLine}</p>
          <div className="space-y-3">{children}</div>
          <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-400">
            {narrativeParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {anchorLine && (
            <p className="text-[10px] leading-snug text-slate-500">{anchorLine}</p>
          )}
          <FactorDetails keys={detailKeys} />
          <p className="text-[10px] leading-snug text-slate-500">{footerHint}</p>
        </div>
      </details>

      <p className="mt-3 text-[10px] leading-snug text-slate-500">
        僅供研究檢視，不構成投資建議。
      </p>
    </div>
  );
}

export function FactorCards({
  current,
  deltas,
  panel,
}: {
  current: CurrentRecord;
  deltas: ScoreDeltas;
  panel: PanelRow[];
}) {
  const growthTopComponents = GROWTH_COMPONENTS.map((c) => ({
    label: c.label,
    z: componentValue(current, c.key),
  }));
  const inflationTopComponents = INFLATION_COMPONENTS.map((c) => ({
    label: c.label,
    z: componentValue(current, c.key),
  }));
  const liquidityTopComponents = LIQUIDITY_COMPONENTS.map((c) => ({
    label: c.label,
    z: componentValue(current, c.key),
  }));
  const riskTopComponents = RISK_DRIVERS.map((row) => ({
    label: row.label,
    z: riskDriverValue(row, current),
  }));

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-100">四維因子拆解</h2>
      <p className="text-sm text-slate-400">
        各維度分數反映宏觀環境的成長、通膨、流動性與風險偏好狀態。展開「模型細節」可查看子項訊號與計算邏輯。
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <FactorCard
          title="Growth"
          titleZh="成長"
          scoreKey="growth_score"
          factorKind="growth"
          panel={panel}
          current={current}
          delta4w={deltas.growth_score}
          accentBorder="border-l-4 border-l-emerald-500/80"
          weightSummaryLine={`子項權重（加總 100%）：${formatCompositionSentence(GROWTH_COMPONENTS)}。`}
          weightStack={<WeightStackBar components={GROWTH_COMPONENTS} />}
          narrativeParagraphs={zCompositeNarrativeParagraphs(GROWTH_COMPONENTS)}
          detailKeys={GROWTH_COMPONENTS.map((c) => c.key)}
          footerHint="橫軸為各子項 z-score（約 ±2）；中央為 0。"
          topComponents={growthTopComponents}
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
          factorKind="inflation"
          panel={panel}
          current={current}
          delta4w={deltas.inflation_score}
          accentBorder="border-l-4 border-l-orange-500/80"
          weightSummaryLine={`子項權重（加總 100%）：${formatCompositionSentence(INFLATION_COMPONENTS)}。`}
          weightStack={<WeightStackBar components={INFLATION_COMPONENTS} />}
          narrativeParagraphs={zCompositeNarrativeParagraphs(INFLATION_COMPONENTS)}
          detailKeys={INFLATION_COMPONENTS.map((c) => c.key)}
          footerHint="橫軸為各子項 z-score（約 ±2）；中央為 0。"
          topComponents={inflationTopComponents}
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
          factorKind="liquidity"
          panel={panel}
          current={current}
          delta4w={deltas.liquidity_score}
          accentBorder="border-l-4 border-l-sky-500/80"
          weightSummaryLine={`子項權重（加總 100%）：${formatCompositionSentence(LIQUIDITY_COMPONENTS)}。`}
          weightStack={<WeightStackBar components={LIQUIDITY_COMPONENTS} />}
          narrativeParagraphs={zCompositeNarrativeParagraphs(LIQUIDITY_COMPONENTS)}
          detailKeys={LIQUIDITY_COMPONENTS.map((c) => c.key)}
          footerHint="橫軸為各子項 z-score（約 ±2）；中央為 0。"
          topComponents={liquidityTopComponents}
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
          factorKind="risk"
          panel={panel}
          current={current}
          delta4w={deltas.risk_score}
          accentBorder="border-l-4 border-l-violet-500/80"
          weightSummaryLine="線性係數：成長 0.34、通膨取負 0.33、流動性 0.33；另加曲線斜率加成係數 0.1（堆疊條為歸一化相對寬度）。"
          weightStack={<RiskWeightStackBar />}
          narrativeParagraphs={RISK_FORMULA_PARAGRAPHS}
          detailKeys={RISK_DRIVERS.map((r) => r.key)}
          footerHint="橫軸為貢獻項數值（約 ±1）；曲線項先 tanh 再納入加總。"
          topComponents={riskTopComponents}
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
