"use client";

import type { LeadLagPair } from "@/lib/types";
// pair.phases (pre-computed full-range) intentionally not used here;
// we always re-segment from the sliced window so the narrative matches the slider.
import { RGuide } from "@/components/RGuide";

interface Props {
  pair: LeadLagPair | null;
  demandLabel: string;
  basketLabel: string;
  weeks: string[];
  rangeStart: number;
  rangeEnd: number;
}

const TAG: Record<string, { cls: string; label: string }> = {
  us_lead: { cls: "bg-green-500/15 text-green-400", label: "美股領先" },
  tw_lead: { cls: "bg-amber-500/15 text-amber-400", label: "台股領先" },
  sync:    { cls: "bg-violet-500/15 text-violet-400", label: "同步" },
  weak:    { cls: "bg-slate-500/20 text-slate-400", label: "弱關聯" },
};

const BORDER: Record<string, string> = {
  us_lead: "border-green-500",
  tw_lead: "border-amber-500",
  sync:    "border-violet-500",
  weak:    "border-slate-600",
};

function corrToHitRate(r: number): number {
  const clamped = Math.max(-1, Math.min(1, r));
  return Math.round((0.5 + Math.asin(clamped) / Math.PI) * 100);
}

export function NarrativeTimeline({
  pair,
  demandLabel,
  basketLabel,
  weeks,
  rangeStart,
  rangeEnd,
}: Props) {
  if (!pair) {
    return (
      <>
        <RGuide />
        <p className="text-sm text-slate-500">選擇需求主題與供應鏈籃子以查看人話時間線。</p>
      </>
    );
  }

  const slicedTypes = pair.weekly_type.slice(rangeStart, rangeEnd + 1);
  const slicedLags = pair.weekly_lag.slice(rangeStart, rangeEnd + 1);
  const slicedCorrs = (pair.weekly_corr as number[]).slice(rangeStart, rangeEnd + 1);
  const slicedWeeks = weeks.slice(rangeStart, rangeEnd + 1);

  // Always re-segment from sliced data so the narrative strictly reflects the slider range
  const computedPhases = autoSegment(slicedTypes, slicedLags, slicedCorrs, slicedWeeks);

  return (
    <div>
      <RGuide />
      <div className="space-y-2.5">
        {computedPhases.length === 0 && (
          <p className="text-sm text-slate-500">此時間範圍內無足夠資料。</p>
        )}
        {computedPhases.map((p, i) => {
          const tag = TAG[p.type] ?? TAG.weak;
          const border = BORDER[p.type] ?? BORDER.weak;
          const absLag = Math.abs(p.avg_lag).toFixed(0);
          const corrDesc =
            p.avg_corr > 0.6 ? "非常強" : p.avg_corr > 0.4 ? "強" : p.avg_corr > 0.25 ? "中等" : "偏弱";
          const hitRate = corrToHitRate(p.avg_corr);
          const hitColor =
            hitRate >= 75 ? "#4ade80" : hitRate >= 65 ? "#f59e0b" : "#8b9cb3";

          let body = "";
          switch (p.type) {
            case "us_lead":
              body = `這段時間（${p.duration} 週），觀察 ${demandLabel} 的走勢，大約 ${absLag} 週後可預期 ${basketLabel} 跟上類似方向。相關性${corrDesc}（r = ${p.avg_corr.toFixed(3)}）。`;
              if (p.avg_corr > 0.4 && p.avg_lag >= 4) {
                body += " → 美國市場情緒與資本支出預期先行定價，台灣供應鏈訂單隨後反映。";
              }
              break;
            case "tw_lead":
              body = `${basketLabel} 反而領先 ${demandLabel} 約 ${absLag} 週（${p.duration} 週）。相關性${corrDesc}（r = ${p.avg_corr.toFixed(3)}）。`;
              if (p.avg_corr > 0.4) {
                body += " → 台灣供應鏈端可能先感受到訂單轉折，比美國終端需求數據更早見頂或見底。";
              }
              break;
            case "sync":
              body = `兩者幾乎同步變動（${p.duration} 週），領先落後差距在 1 週以內。相關性${corrDesc}（r = ${p.avg_corr.toFixed(3)}）。 → 可能是全球性事件同時衝擊兩個市場。`;
              break;
            default:
              body = `這段時間（${p.duration} 週）兩者各走各的路，統計關聯性偏弱（r = ${p.avg_corr.toFixed(3)}）。 → 不宜用其中一方預測另一方。`;
          }

          return (
            <div
              key={i}
              className={`rounded-lg border-l-4 bg-black/20 p-3 hover:bg-black/30 transition-colors ${border}`}
            >
              <p className="mb-1 text-[11px] text-slate-500">
                {p.start_date} → {p.end_date}（{p.duration} 週）
              </p>
              <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold mr-1.5 ${tag.cls}`}>
                {tag.label}
              </span>
              <span className="inline-block rounded px-1.5 py-0.5 text-[11px] bg-slate-800/60 text-slate-400 mr-1.5">
                領先 {absLag} 週 · r = {p.avg_corr.toFixed(3)}
              </span>
              <span
                className="inline-block rounded px-1.5 py-0.5 text-[11px] bg-slate-800/60"
                style={{ color: hitColor }}
              >
                同向機率 ~{hitRate}%
              </span>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">{body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function autoSegment(
  types: string[],
  lags: number[],
  corrs: number[],
  weeks: string[],
): { type: string; start_date: string; end_date: string; duration: number; avg_lag: number; avg_corr: number; max_corr: number }[] {
  if (!types.length) return [];

  const phases: {
    type: string; start: number; end: number;
    lags: number[]; corrs: number[];
  }[] = [];

  let cur = { type: types[0], start: 0, end: 0, lags: [lags[0]], corrs: [corrs[0] ?? 0] };
  for (let i = 1; i < types.length; i++) {
    if (types[i] === cur.type) {
      cur.end = i; cur.lags.push(lags[i]); cur.corrs.push(corrs[i] ?? 0);
    } else {
      phases.push(cur);
      cur = { type: types[i], start: i, end: i, lags: [lags[i]], corrs: [corrs[i] ?? 0] };
    }
  }
  phases.push(cur);

  const merged: typeof phases = [];
  for (const p of phases) {
    if (p.end - p.start + 1 < 4 && merged.length) {
      const prev = merged[merged.length - 1];
      prev.end = p.end; prev.lags.push(...p.lags); prev.corrs.push(...p.corrs);
    } else {
      merged.push(p);
    }
  }

  return merged.map((p) => {
    const avgLag = p.lags.reduce((s, v) => s + v, 0) / p.lags.length;
    const avgCorr = p.corrs.reduce((s, v) => s + v, 0) / p.corrs.length;
    return {
      type: p.type,
      start_date: weeks[p.start] ?? `week[${p.start}]`,
      end_date: weeks[p.end] ?? `week[${p.end}]`,
      duration: p.end - p.start + 1,
      avg_lag: avgLag,
      avg_corr: avgCorr,
      max_corr: Math.max(...p.corrs),
    };
  });
}
